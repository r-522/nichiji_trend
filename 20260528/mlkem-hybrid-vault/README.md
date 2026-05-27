# mlkem-hybrid-vault

A tiny, dependency-free CLI demonstrating **post-quantum hybrid encryption** —
the same construction now shipping in production TLS: classical **X25519**
elliptic-curve Diffie-Hellman combined with NIST-standardised **ML-KEM-768**
(FIPS 203, formerly CRYSTALS-Kyber).

An attacker must break **both** the classical and the post-quantum primitive to
recover a message, so the scheme stays secure against today's adversaries *and*
against a future quantum computer running a "harvest now, decrypt later" attack.

Built entirely on the **Go 1.24 standard library** (`crypto/mlkem`,
`crypto/ecdh`, `crypto/hkdf`, `crypto/aes`) — **no third-party dependencies**.

## Requirements

- Go **1.24+** (ships `crypto/mlkem` and `crypto/hkdf` in the standard library)

## Build

```sh
go build -o mlkem-hybrid-vault .
```

## Usage

```sh
# 1. Generate a recipient key pair -> recipient.pub + recipient.key
./mlkem-hybrid-vault keygen -out recipient

# 2. Encrypt a message to the recipient's public bundle
echo "top secret" | ./mlkem-hybrid-vault encrypt -pub recipient.pub -out msg.enc
#   or with files:
./mlkem-hybrid-vault encrypt -pub recipient.pub -in plain.txt -out msg.enc

# 3. Decrypt with the recipient's secret bundle
./mlkem-hybrid-vault decrypt -key recipient.key -in msg.enc

# Self-contained end-to-end demonstration + tamper check
./mlkem-hybrid-vault demo
```

`-in` / `-out` default to stdin / stdout, so the tool composes in pipes:

```sh
echo "hi" | ./mlkem-hybrid-vault encrypt -pub recipient.pub \
          | ./mlkem-hybrid-vault decrypt -key recipient.key
```

## How it works

**Key pair (recipient, long-term)**

| component | algorithm | public | secret |
| :-- | :-- | --: | --: |
| classical | X25519 | 32 B | 32 B |
| post-quantum | ML-KEM-768 | 1184 B | 64 B (seed) |

- Public bundle: `x25519_pub(32) ‖ mlkem_ek(1184)` = **1216 B** (base64 in `.pub`)
- Secret bundle: `x25519_prv(32) ‖ mlkem_seed(64)` = **96 B** (base64 in `.key`, mode 0600)

**Seal (encrypt)**

1. **PQ half** — ML-KEM-768 encapsulation against the recipient's key →
   `(ss_kem, kem_ct)` where `kem_ct` is 1088 B.
2. **Classical half** — generate an ephemeral X25519 key, ECDH against the
   recipient's X25519 public key → `ss_ecdh`.
3. **Combine** — `HKDF-SHA256(secret = ss_ecdh ‖ ss_kem, salt = SHA256(eph_pub ‖ kem_ct), info = label)`
   → 32-byte AES key. The transcript is folded into the salt, binding the key to
   this exact exchange.
4. **AEAD** — AES-256-GCM encrypts the plaintext; the header (`eph_pub ‖ kem_ct`)
   is authenticated as additional data.

**Envelope layout**

```
eph_x25519_pub(32) ‖ mlkem_ct(1088) ‖ nonce(12) ‖ aes-256-gcm(ciphertext+tag)
```

**Open (decrypt)** reverses the process: ML-KEM decapsulation + X25519 ECDH
reproduce the same two shared secrets, HKDF re-derives the AES key, and AES-GCM
verifies + decrypts. Any tampering (or a wrong key) fails the GCM tag check.

## Tests

```sh
go test ./...
```

Covers the roundtrip, persisted-key decryption, tamper detection, wrong-key
rejection, and wire-format sizes.

> Educational demonstration of the ML-KEM-768 hybrid construction. Review
> carefully before relying on it for production secrets.
