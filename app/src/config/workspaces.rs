use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub app_token: String,
    pub bot_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspacesConfig {
    #[serde(flatten)]
    pub workspaces: HashMap<String, WorkspaceConfig>,
}

impl WorkspacesConfig {
    pub fn load_from_file(path: &str) -> Result<Self> {
        let contents = fs::read_to_string(path)?;
        let config: WorkspacesConfig = serde_yaml::from_str(&contents)?;
        Ok(config)
    }

    pub fn get_workspace(&self, name: &str) -> Option<&WorkspaceConfig> {
        self.workspaces.get(name)
    }

    pub fn list_workspaces(&self) -> Vec<String> {
        self.workspaces.keys().cloned().collect()
    }
}
