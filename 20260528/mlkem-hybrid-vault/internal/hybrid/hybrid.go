// Package hybrid implements a post-quantum hybrid encryption scheme that
// combines classical X25519 elliptic-curve Diffie-Hellman with the
// NIST-standardised ML-KEM-768 (FIPS 203) key-encapsulation mechanism.
//
// The design mirrors the "hybrid" approach now shipping in production TLS
// stacks (e.g. Chrome's X25519+ML-KEM-768 key exchange): an attacker must
// break BOTH the classical and the post-quantum primitive to recover the
// session key, so the scheme stays secure even against a future
// cryptographically-relevant quantum computer ("harvest now, decrypt later").
//
// Everything here relies only on the Go 1.24 standard library
// (crypto/mlkem, crypto/ecdh, crypto/hkdf, crypto/aes) — no third-party deps.
package hybrid

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/mlkem"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
)

// Wire-format sizes (bytes) for the primitives we use.
const (
	x25519PubLen = 32
	x25519PrvLen = 32
	mlkemEKLen   = mlkem.EncapsulationKeySize768 // 1184
	mlkemDKLen   = mlkem.SeedSize                // 64 (seed form)
	mlkemCTLen   = mlkem.CiphertextSize768       // 1088
	nonceLen     = 12
	aeadKeyLen   = 32

	// kdfLabel binds derived keys to this exact scheme + version, providing
	// domain separation from any other use of the same shared secrets.
	kdfLabel = "mlkem-hybrid-vault/v1 aead-key"
)

// KeyPair is a recipient's long-term hybrid key material.
type KeyPair struct {
	x25519 *ecdh.PrivateKey
	mlkem  *mlkem.DecapsulationKey768
}

// GenerateKeyPair creates a fresh hybrid recipient key pair.
func GenerateKeyPair() (*KeyPair, error) {
	xPriv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("x25519 keygen: %w", err)
	}
	dk, err := mlkem.GenerateKey768()
	if err != nil {
		return nil, fmt.Errorf("ml-kem keygen: %w", err)
	}
	return &KeyPair{x25519: xPriv, mlkem: dk}, nil
}

// PublicBytes returns the recipient's public bundle:
//
//	x25519_public (32) || mlkem768_encapsulation_key (1184)
func (k *KeyPair) PublicBytes() []byte {
	out := make([]byte, 0, x25519PubLen+mlkemEKLen)
	out = append(out, k.x25519.PublicKey().Bytes()...)
	out = append(out, k.mlkem.EncapsulationKey().Bytes()...)
	return out
}

// SecretBytes returns the recipient's secret bundle:
//
//	x25519_private (32) || mlkem768_decapsulation_seed (64)
//
// Treat the result as highly sensitive key material.
func (k *KeyPair) SecretBytes() []byte {
	out := make([]byte, 0, x25519PrvLen+mlkemDKLen)
	out = append(out, k.x25519.Bytes()...)
	out = append(out, k.mlkem.Bytes()...)
	return out
}

// LoadKeyPair reconstructs a KeyPair from a secret bundle produced by
// SecretBytes.
func LoadKeyPair(secret []byte) (*KeyPair, error) {
	if len(secret) != x25519PrvLen+mlkemDKLen {
		return nil, fmt.Errorf("secret bundle: expected %d bytes, got %d",
			x25519PrvLen+mlkemDKLen, len(secret))
	}
	xPriv, err := ecdh.X25519().NewPrivateKey(secret[:x25519PrvLen])
	if err != nil {
		return nil, fmt.Errorf("x25519 private: %w", err)
	}
	dk, err := mlkem.NewDecapsulationKey768(secret[x25519PrvLen:])
	if err != nil {
		return nil, fmt.Errorf("ml-kem decapsulation key: %w", err)
	}
	return &KeyPair{x25519: xPriv, mlkem: dk}, nil
}

// parsePublic splits a public bundle into its two components.
func parsePublic(pub []byte) (*ecdh.PublicKey, *mlkem.EncapsulationKey768, error) {
	if len(pub) != x25519PubLen+mlkemEKLen {
		return nil, nil, fmt.Errorf("public bundle: expected %d bytes, got %d",
			x25519PubLen+mlkemEKLen, len(pub))
	}
	xPub, err := ecdh.X25519().NewPublicKey(pub[:x25519PubLen])
	if err != nil {
		return nil, nil, fmt.Errorf("x25519 public: %w", err)
	}
	ek, err := mlkem.NewEncapsulationKey768(pub[x25519PubLen:])
	if err != nil {
		return nil, nil, fmt.Errorf("ml-kem encapsulation key: %w", err)
	}
	return xPub, ek, nil
}

// deriveKey turns the two shared secrets into a single AEAD key. The KEM
// ciphertext and the ephemeral X25519 public key are folded into the HKDF
// salt so the derived key is cryptographically bound to this exact transcript.
func deriveKey(ecdhSS, kemSS, ephPub, kemCT []byte) ([]byte, error) {
	secret := make([]byte, 0, len(ecdhSS)+len(kemSS))
	secret = append(secret, ecdhSS...)
	secret = append(secret, kemSS...)

	transcript := sha256.New()
	transcript.Write(ephPub)
	transcript.Write(kemCT)
	salt := transcript.Sum(nil)

	return hkdf.Key(sha256.New, secret, salt, kdfLabel, aeadKeyLen)
}

// Seal encrypts plaintext to a recipient public bundle and returns a
// self-contained ciphertext envelope:
//
//	eph_x25519_public (32) || mlkem_ciphertext (1088) || aes_gcm_nonce (12) || aes_gcm_ciphertext
func Seal(pub, plaintext []byte) ([]byte, error) {
	xPub, ek, err := parsePublic(pub)
	if err != nil {
		return nil, err
	}

	// Post-quantum half: encapsulate to the recipient's ML-KEM key.
	kemSS, kemCT := ek.Encapsulate()

	// Classical half: ephemeral X25519 ECDH against the recipient's key.
	eph, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("ephemeral x25519: %w", err)
	}
	ecdhSS, err := eph.ECDH(xPub)
	if err != nil {
		return nil, fmt.Errorf("x25519 ecdh: %w", err)
	}
	ephPub := eph.PublicKey().Bytes()

	key, err := deriveKey(ecdhSS, kemSS, ephPub, kemCT)
	if err != nil {
		return nil, fmt.Errorf("hkdf: %w", err)
	}

	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, nonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("nonce: %w", err)
	}

	out := make([]byte, 0, x25519PubLen+mlkemCTLen+nonceLen+len(plaintext)+gcm.Overhead())
	out = append(out, ephPub...)
	out = append(out, kemCT...)
	out = append(out, nonce...)
	// Authenticate the header bytes (eph pub + KEM ct) as additional data.
	aad := out[:x25519PubLen+mlkemCTLen]
	out = gcm.Seal(out, nonce, plaintext, aad)
	return out, nil
}

// Open decrypts an envelope produced by Seal using the recipient key pair.
func Open(k *KeyPair, envelope []byte) ([]byte, error) {
	const headerLen = x25519PubLen + mlkemCTLen + nonceLen
	if len(envelope) < headerLen {
		return nil, errors.New("envelope too short")
	}
	ephPubBytes := envelope[:x25519PubLen]
	kemCT := envelope[x25519PubLen : x25519PubLen+mlkemCTLen]
	nonce := envelope[x25519PubLen+mlkemCTLen : headerLen]
	ct := envelope[headerLen:]

	ephPub, err := ecdh.X25519().NewPublicKey(ephPubBytes)
	if err != nil {
		return nil, fmt.Errorf("ephemeral public: %w", err)
	}
	ecdhSS, err := k.x25519.ECDH(ephPub)
	if err != nil {
		return nil, fmt.Errorf("x25519 ecdh: %w", err)
	}
	kemSS, err := k.mlkem.Decapsulate(kemCT)
	if err != nil {
		return nil, fmt.Errorf("ml-kem decapsulate: %w", err)
	}

	key, err := deriveKey(ecdhSS, kemSS, ephPubBytes, kemCT)
	if err != nil {
		return nil, fmt.Errorf("hkdf: %w", err)
	}

	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	aad := envelope[:x25519PubLen+mlkemCTLen]
	pt, err := gcm.Open(nil, nonce, ct, aad)
	if err != nil {
		return nil, fmt.Errorf("aead open (wrong key or tampered ciphertext): %w", err)
	}
	return pt, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm: %w", err)
	}
	return gcm, nil
}
