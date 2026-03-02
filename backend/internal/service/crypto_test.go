package service

import (
	"bytes"
	"testing"
)

func TestCryptoService_RoundTrip(t *testing.T) {
	crypto := NewCryptoService("my-test-passphrase")
	plaintext := []byte("super-secret-api-key-123")

	encrypted, err := crypto.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if bytes.Equal(encrypted, plaintext) {
		t.Error("encrypted data should differ from plaintext")
	}

	decrypted, err := crypto.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if !bytes.Equal(decrypted, plaintext) {
		t.Errorf("expected %q, got %q", plaintext, decrypted)
	}
}

func TestCryptoService_DifferentNonces(t *testing.T) {
	crypto := NewCryptoService("passphrase")
	plaintext := []byte("same-input")

	enc1, _ := crypto.Encrypt(plaintext)
	enc2, _ := crypto.Encrypt(plaintext)

	// Two encryptions of the same plaintext should produce different ciphertexts (random nonce)
	if bytes.Equal(enc1, enc2) {
		t.Error("two encryptions of same plaintext should differ (random nonce)")
	}

	// But both should decrypt to the same plaintext
	dec1, _ := crypto.Decrypt(enc1)
	dec2, _ := crypto.Decrypt(enc2)
	if !bytes.Equal(dec1, dec2) {
		t.Error("both decryptions should produce same plaintext")
	}
}

func TestCryptoService_WrongPassphrase(t *testing.T) {
	crypto1 := NewCryptoService("passphrase-1")
	crypto2 := NewCryptoService("passphrase-2")

	encrypted, _ := crypto1.Encrypt([]byte("secret"))

	_, err := crypto2.Decrypt(encrypted)
	if err == nil {
		t.Error("expected error when decrypting with wrong passphrase")
	}
}

func TestCryptoService_TruncatedCiphertext(t *testing.T) {
	crypto := NewCryptoService("passphrase")

	_, err := crypto.Decrypt([]byte("short"))
	if err == nil {
		t.Error("expected error for truncated ciphertext")
	}
}

func TestCryptoService_EmptyPlaintext(t *testing.T) {
	crypto := NewCryptoService("passphrase")

	encrypted, err := crypto.Encrypt([]byte(""))
	if err != nil {
		t.Fatalf("Encrypt empty failed: %v", err)
	}

	decrypted, err := crypto.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt empty failed: %v", err)
	}

	if string(decrypted) != "" {
		t.Errorf("expected empty string, got %q", decrypted)
	}
}
