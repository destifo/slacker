use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BotStatus {
    pub workspace_name: String,
    pub is_connected: bool,
    pub connected_at: Option<DateTime<Utc>>,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub is_syncing: bool,
    pub sync_progress: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct BotStatusManager {
    statuses: Arc<RwLock<HashMap<String, BotStatus>>>,
}

impl BotStatusManager {
    pub fn new() -> Self {
        Self {
            statuses: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Mark a bot as connected
    pub async fn set_connected(&self, workspace_name: &str) {
        let mut statuses = self.statuses.write().await;
        let now = Utc::now();
        statuses.insert(
            workspace_name.to_string(),
            BotStatus {
                workspace_name: workspace_name.to_string(),
                is_connected: true,
                connected_at: Some(now),
                last_heartbeat: Some(now),
                error_message: None,
                is_syncing: false,
                sync_progress: None,
            },
        );
    }

    /// Mark a bot as disconnected
    pub async fn set_disconnected(&self, workspace_name: &str, error: Option<String>) {
        let mut statuses = self.statuses.write().await;
        if let Some(status) = statuses.get_mut(workspace_name) {
            status.is_connected = false;
            status.error_message = error;
            status.is_syncing = false;
            status.sync_progress = None;
        } else {
            statuses.insert(
                workspace_name.to_string(),
                BotStatus {
                    workspace_name: workspace_name.to_string(),
                    is_connected: false,
                    connected_at: None,
                    last_heartbeat: None,
                    error_message: error,
                    is_syncing: false,
                    sync_progress: None,
                },
            );
        }
    }

    /// Mark a bot as syncing
    pub async fn set_syncing(&self, workspace_name: &str, progress: Option<String>) {
        let mut statuses = self.statuses.write().await;
        if let Some(status) = statuses.get_mut(workspace_name) {
            status.is_syncing = true;
            status.sync_progress = progress;
        }
    }

    /// Mark sync as complete
    pub async fn set_sync_complete(&self, workspace_name: &str) {
        let mut statuses = self.statuses.write().await;
        if let Some(status) = statuses.get_mut(workspace_name) {
            status.is_syncing = false;
            status.sync_progress = None;
        }
    }

    /// Update heartbeat timestamp
    pub async fn heartbeat(&self, workspace_name: &str) {
        let mut statuses = self.statuses.write().await;
        if let Some(status) = statuses.get_mut(workspace_name) {
            status.last_heartbeat = Some(Utc::now());
        }
    }

    /// Get status for a specific workspace
    pub async fn get_status(&self, workspace_name: &str) -> Option<BotStatus> {
        let statuses = self.statuses.read().await;
        statuses.get(workspace_name).cloned()
    }

    /// Get all statuses
    pub async fn get_all_statuses(&self) -> Vec<BotStatus> {
        let statuses = self.statuses.read().await;
        statuses.values().cloned().collect()
    }

    /// Check if a workspace is connected
    pub async fn is_connected(&self, workspace_name: &str) -> bool {
        let statuses = self.statuses.read().await;
        statuses
            .get(workspace_name)
            .map(|s| s.is_connected)
            .unwrap_or(false)
    }
}

