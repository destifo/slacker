use sea_orm::DatabaseConnection;
use tracing::{error, info};

use crate::config::config::Config;
use crate::sockets::slack_bot::SlackBot;

use super::bot_status::BotStatusManager;

#[derive(Clone, Debug)]
pub struct AppState {
    pub database: DatabaseConnection,
    pub config: Config,
    pub bot_status: BotStatusManager,
}

impl AppState {
    /// Spawn a new SlackBot for a workspace in the background
    pub fn spawn_bot(&self, workspace_name: String, app_token: String, bot_token: String) {
        let db = self.database.clone();
        let bot_status = self.bot_status.clone();

        tokio::spawn(async move {
            let bot = SlackBot::new(workspace_name.clone(), app_token, bot_token, db, bot_status);

            info!(
                "Dynamically starting SlackBot for workspace: {}",
                workspace_name
            );
            if let Err(e) = bot.start().await {
                error!("SlackBot for workspace {} failed: {}", workspace_name, e);
            }
        });
    }
}
