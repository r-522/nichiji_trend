package hybrid

import (
	"bytes"
	"testing"
)

func TestSealOpenRoundTrip(t *testing.T) {
	kp, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}
	msg := []byte("post-quantum hello, 量子耐性メッセージ")

	env, err := Seal(kp.PublicBytes(), msg)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	got, err := Open(kp, env)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if !bytes.Equal(got, msg) {
		t.Fatalf("round trip mismatch: got %q want %q", got, msg)
	}
}

func TestLoadKeyPairPreservesDecryption(t *testing.T) {
	kp, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}
	msg := []byte("persisted key works")
	env, err := Seal(kp.PublicBytes(), msg)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	reloaded, err := LoadKeyPair(kp.SecretBytes())
	if err != nil {
		t.Fatalf("LoadKeyPair: %v", err)
	}
	got, err := Open(reloaded, env)
	if err != nil {
		t.Fatalf("Open with reloaded key: %v", err)
	}
	if !bytes.Equal(got, msg) {
		t.Fatalf("reloaded key decrypt mismatch")
	}
}

func TestTamperDetected(t *testing.T) {
	kp, _ := GenerateKeyPair()
	env, err := Seal(kp.PublicBytes(), []byte("secret"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	env[len(env)-1] ^= 0xff // flip a bit in the AEAD tag/ciphertext
	if _, err := Open(kp, env); err == nil {
		t.Fatal("expected authentication failure on tampered envelope, got nil")
	}
}

func TestWrongKeyFails(t *testing.T) {
	kp, _ := GenerateKeyPair()
	other, _ := GenerateKeyPair()
	env, err := Seal(kp.PublicBytes(), []byte("for kp only"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if _, err := Open(other, env); err == nil {
		t.Fatal("expected decryption with wrong key to fail")
	}
}

func TestBundleSizes(t *testing.T) {
	kp, _ := GenerateKeyPair()
	if got := len(kp.PublicBytes()); got != x25519PubLen+mlkemEKLen {
		t.Errorf("public bundle size = %d, want %d", got, x25519PubLen+mlkemEKLen)
	}
	if got := len(kp.SecretBytes()); got != x25519PrvLen+mlkemDKLen {
		t.Errorf("secret bundle size = %d, want %d", got, x25519PrvLen+mlkemDKLen)
	}
}
