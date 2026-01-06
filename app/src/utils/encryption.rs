use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;

const NONCE_SIZE: usize = 12;

/// Encrypt a string using AES-256-GCM
/// Returns base64 encoded string: "nonce:ciphertext"
pub fn encrypt(plaintext: &str, key: &str) -> Result<String> {
    // Derive 32-byte key from the provided key (using simple padding/truncation)
    let key_bytes = derive_key(key);
    
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| anyhow!("Failed to create cipher: {}", e))?;
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;
    
    // Encode as base64: nonce:ciphertext
    let nonce_b64 = BASE64.encode(nonce_bytes);
    let ciphertext_b64 = BASE64.encode(&ciphertext);
    
    Ok(format!("{}:{}", nonce_b64, ciphertext_b64))
}

/// Decrypt a string encrypted with encrypt()
/// Input format: "nonce:ciphertext" (base64 encoded)
pub fn decrypt(encrypted: &str, key: &str) -> Result<String> {
    let parts: Vec<&str> = encrypted.split(':').collect();
    if parts.len() != 2 {
        return Err(anyhow!("Invalid encrypted format"));
    }
    
    let nonce_bytes = BASE64.decode(parts[0])
        .map_err(|e| anyhow!("Failed to decode nonce: {}", e))?;
    let ciphertext = BASE64.decode(parts[1])
        .map_err(|e| anyhow!("Failed to decode ciphertext: {}", e))?;
    
    if nonce_bytes.len() != NONCE_SIZE {
        return Err(anyhow!("Invalid nonce size"));
    }
    
    let key_bytes = derive_key(key);
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| anyhow!("Failed to create cipher: {}", e))?;
    
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| anyhow!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext)
        .map_err(|e| anyhow!("Failed to convert decrypted bytes to string: {}", e))
}

/// Derive a 32-byte key from any string
fn derive_key(key: &str) -> [u8; 32] {
    let mut key_bytes = [0u8; 32];
    let key_data = key.as_bytes();
    
    // Simple key derivation: repeat/truncate to 32 bytes
    // For production, use a proper KDF like PBKDF2 or Argon2
    for (i, byte) in key_bytes.iter_mut().enumerate() {
        *byte = key_data[i % key_data.len()];
    }
    
    key_bytes
}

/// Check if a string looks like it's encrypted (has our format)
pub fn is_encrypted(value: &str) -> bool {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    // Check if both parts are valid base64
    BASE64.decode(parts[0]).is_ok() && BASE64.decode(parts[1]).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = "my-secret-master-key-12345";
        let plaintext = "xoxb-123456789-abcdefghijk";
        
        let encrypted = encrypt(plaintext, key).unwrap();
        assert!(is_encrypted(&encrypted));
        
        let decrypted = decrypt(&encrypted, key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key = "correct-key";
        let wrong_key = "wrong-key";
        let plaintext = "secret-token";
        
        let encrypted = encrypt(plaintext, key).unwrap();
        let result = decrypt(&encrypted, wrong_key);
        
        assert!(result.is_err());
    }
}

