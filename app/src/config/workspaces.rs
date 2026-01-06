use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs};

use crate::utils::encryption::{decrypt, encrypt, is_encrypted};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub app_token: String,
    pub bot_token: String,
}

impl WorkspaceConfig {
    /// Encrypt tokens before storage
    pub fn encrypt(&self, encryption_key: &str) -> Result<Self> {
        Ok(Self {
            app_token: encrypt(&self.app_token, encryption_key)?,
            bot_token: encrypt(&self.bot_token, encryption_key)?,
        })
    }

    /// Decrypt tokens after loading
    pub fn decrypt(&self, encryption_key: &str) -> Result<Self> {
        // Only decrypt if tokens appear to be encrypted
        let app_token = if is_encrypted(&self.app_token) {
            decrypt(&self.app_token, encryption_key)?
        } else {
            self.app_token.clone()
        };

        let bot_token = if is_encrypted(&self.bot_token) {
            decrypt(&self.bot_token, encryption_key)?
        } else {
            self.bot_token.clone()
        };

        Ok(Self {
            app_token,
            bot_token,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspacesConfig {
    #[serde(flatten)]
    pub workspaces: HashMap<String, WorkspaceConfig>,
}

impl WorkspacesConfig {
    pub fn new() -> Self {
        Self {
            workspaces: HashMap::new(),
        }
    }

    pub fn load_from_file(path: &str) -> Result<Self> {
        let contents = fs::read_to_string(path)?;

        // Handle empty file
        if contents.trim().is_empty() {
            return Ok(Self::new());
        }

        let config: WorkspacesConfig = serde_yaml::from_str(&contents)?;
        Ok(config)
    }

    /// Load and decrypt all workspace tokens
    pub fn load_and_decrypt(path: &str, encryption_key: &str) -> Result<Self> {
        // If file doesn't exist, return empty config
        if !std::path::Path::new(path).exists() {
            return Ok(Self::new());
        }

        let mut config = Self::load_from_file(path)?;

        let mut decrypted_workspaces = HashMap::new();
        for (name, workspace) in config.workspaces {
            decrypted_workspaces.insert(name, workspace.decrypt(encryption_key)?);
        }
        config.workspaces = decrypted_workspaces;

        Ok(config)
    }

    pub fn save_to_file(&self, path: &str) -> Result<()> {
        let contents = serde_yaml::to_string(&self)?;
        fs::write(path, contents)?;
        Ok(())
    }

    /// Encrypt and save workspace config
    pub fn save_encrypted(&self, path: &str, encryption_key: &str) -> Result<()> {
        let mut encrypted_config = Self::new();

        for (name, workspace) in &self.workspaces {
            encrypted_config
                .workspaces
                .insert(name.clone(), workspace.encrypt(encryption_key)?);
        }

        encrypted_config.save_to_file(path)
    }

    pub fn get_workspace(&self, name: &str) -> Option<&WorkspaceConfig> {
        self.workspaces.get(name)
    }

    pub fn add_workspace(&mut self, name: String, config: WorkspaceConfig) {
        self.workspaces.insert(name, config);
    }

    pub fn list_workspaces(&self) -> Vec<String> {
        self.workspaces.keys().cloned().collect()
    }
}
