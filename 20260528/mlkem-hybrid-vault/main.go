// mlkem-hybrid-vault is a small CLI that demonstrates post-quantum hybrid
// encryption (X25519 + ML-KEM-768, FIPS 203) using only the Go 1.24 standard
// library.
//
// Subcommands:
//
//	keygen  -out NAME              generate NAME.pub and NAME.key
//	encrypt -pub NAME.pub [-in F] [-out F]    encrypt stdin/file to a recipient
//	decrypt -key NAME.key [-in F] [-out F]    decrypt with the recipient secret
//	demo                          run an end-to-end roundtrip and print a report
package main

import (
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/nichiji/mlkem-hybrid-vault/internal/hybrid"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "keygen":
		err = cmdKeygen(os.Args[2:])
	case "encrypt":
		err = cmdEncrypt(os.Args[2:])
	case "decrypt":
		err = cmdDecrypt(os.Args[2:])
	case "demo":
		err = cmdDemo()
	case "-h", "--help", "help":
		usage()
		return
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `mlkem-hybrid-vault — post-quantum hybrid encryption (X25519 + ML-KEM-768)

usage:
  mlkem-hybrid-vault keygen  -out NAME
  mlkem-hybrid-vault encrypt -pub NAME.pub [-in FILE] [-out FILE]
  mlkem-hybrid-vault decrypt -key NAME.key [-in FILE] [-out FILE]
  mlkem-hybrid-vault demo

If -in/-out are omitted, encrypt/decrypt read stdin and write stdout.
Key files are base64; ciphertext is raw binary.
`)
}

func cmdKeygen(args []string) error {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	out := fs.String("out", "recipient", "base name for the .pub and .key files")
	_ = fs.Parse(args)

	kp, err := hybrid.GenerateKeyPair()
	if err != nil {
		return err
	}
	pubPath := *out + ".pub"
	keyPath := *out + ".key"
	if err := writeB64(pubPath, kp.PublicBytes(), 0o644); err != nil {
		return err
	}
	if err := writeB64(keyPath, kp.SecretBytes(), 0o600); err != nil {
		return err
	}
	fmt.Printf("wrote public key  -> %s (%d bytes)\n", pubPath, len(kp.PublicBytes()))
	fmt.Printf("wrote secret key  -> %s (%d bytes, mode 0600)\n", keyPath, len(kp.SecretBytes()))
	return nil
}

func cmdEncrypt(args []string) error {
	fs := flag.NewFlagSet("encrypt", flag.ExitOnError)
	pub := fs.String("pub", "", "recipient public key file (.pub)")
	in := fs.String("in", "", "input file (default: stdin)")
	out := fs.String("out", "", "output file (default: stdout)")
	_ = fs.Parse(args)
	if *pub == "" {
		return errors.New("-pub is required")
	}
	pubBytes, err := readB64(*pub)
	if err != nil {
		return err
	}
	plaintext, err := readInput(*in)
	if err != nil {
		return err
	}
	env, err := hybrid.Seal(pubBytes, plaintext)
	if err != nil {
		return err
	}
	return writeOutput(*out, env)
}

func cmdDecrypt(args []string) error {
	fs := flag.NewFlagSet("decrypt", flag.ExitOnError)
	key := fs.String("key", "", "recipient secret key file (.key)")
	in := fs.String("in", "", "input file (default: stdin)")
	out := fs.String("out", "", "output file (default: stdout)")
	_ = fs.Parse(args)
	if *key == "" {
		return errors.New("-key is required")
	}
	secret, err := readB64(*key)
	if err != nil {
		return err
	}
	kp, err := hybrid.LoadKeyPair(secret)
	if err != nil {
		return err
	}
	env, err := readInput(*in)
	if err != nil {
		return err
	}
	pt, err := hybrid.Open(kp, env)
	if err != nil {
		return err
	}
	return writeOutput(*out, pt)
}

func cmdDemo() error {
	fmt.Println("=== mlkem-hybrid-vault demo: X25519 + ML-KEM-768 hybrid encryption ===")
	kp, err := hybrid.GenerateKeyPair()
	if err != nil {
		return err
	}
	fmt.Printf("recipient public bundle : %d bytes\n", len(kp.PublicBytes()))
	fmt.Printf("recipient secret bundle : %d bytes\n", len(kp.SecretBytes()))

	msg := []byte("Harvest now, decrypt later? Not with ML-KEM-768. 量子耐性。")
	fmt.Printf("\nplaintext (%d bytes): %s\n", len(msg), msg)

	env, err := hybrid.Seal(kp.PublicBytes(), msg)
	if err != nil {
		return err
	}
	fmt.Printf("sealed envelope         : %d bytes\n", len(env))
	fmt.Println("  layout: eph_x25519(32) || mlkem_ct(1088) || nonce(12) || aes-256-gcm")

	pt, err := hybrid.Open(kp, env)
	if err != nil {
		return err
	}
	fmt.Printf("\ndecrypted               : %s\n", pt)

	// Tamper check.
	tampered := append([]byte(nil), env...)
	tampered[len(tampered)-1] ^= 0x01
	if _, err := hybrid.Open(kp, tampered); err != nil {
		fmt.Println("tamper test             : OK (modified ciphertext rejected)")
	} else {
		return errors.New("tamper test FAILED: modified ciphertext accepted")
	}
	fmt.Println("\nresult                  : roundtrip OK ✔")
	return nil
}

// ---- small IO helpers ----

func writeB64(path string, data []byte, mode os.FileMode) error {
	enc := base64.StdEncoding.EncodeToString(data)
	return os.WriteFile(path, []byte(enc+"\n"), mode)
}

func readB64(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	dec, err := base64.StdEncoding.DecodeString(trimSpace(string(raw)))
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return dec, nil
}

func readInput(path string) ([]byte, error) {
	if path == "" {
		return io.ReadAll(os.Stdin)
	}
	return os.ReadFile(path)
}

func writeOutput(path string, data []byte) error {
	if path == "" {
		_, err := os.Stdout.Write(data)
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && isSpace(s[start]) {
		start++
	}
	for end > start && isSpace(s[end-1]) {
		end--
	}
	return s[start:end]
}

func isSpace(b byte) bool {
	return b == ' ' || b == '\n' || b == '\r' || b == '\t'
}
