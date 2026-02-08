use std::net::{IpAddr, SocketAddr};

use anyhow::Result;
use dotenvy::dotenv;
use slacker::{
    config::{config::Config, workspaces::WorkspacesConfig},
    core::server::create_server,
    sockets::slack_bot::SlackBot,
};
use tokio::signal;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let config = Config::load_envs().expect("Failed to load envs");

    // Check if using default encryption key
    if config.encryption_key == "change-this-default-encryption-key-in-production" {
        warn!("⚠️  Using default encryption key! Set ENCRYPTION_KEY in production!");
    }

    let port: u16 = config.port.clone();
    let server_ip_str: String = config.server_ip.clone();
    let server_ip: IpAddr = server_ip_str.parse().unwrap_or(IpAddr::from([0, 0, 0, 0]));
    let addr = SocketAddr::new(server_ip, port);
    let (server, db_conn, bot_status) = create_server(config.clone()).await?;

    let shutdown_token = CancellationToken::new();

    // Load and decrypt workspaces, spawn a bot for each
    match WorkspacesConfig::load_and_decrypt("workspaces.yaml", &config.encryption_key) {
        Ok(workspaces_config) => {
            info!(
                "Loaded {} workspaces from config",
                workspaces_config.workspaces.len()
            );

            for (workspace_name, workspace_config) in workspaces_config.workspaces {
                let bot = SlackBot::new(
                    workspace_name.clone(),
                    workspace_config.app_token,
                    workspace_config.bot_token,
                    db_conn.clone(),
                    bot_status.clone(),
                );

                let token = shutdown_token.clone();
                tokio::spawn(async move {
                    info!("Starting SlackBot for workspace: {}", workspace_name);
                    if let Err(e) = bot.start(token).await {
                        error!("SlackBot for workspace {} failed: {}", workspace_name, e);
                    }
                });
            }
        }
        Err(e) => {
            error!("Failed to load workspaces.yaml: {}", e);
            error!("SlackBots will not start. Please create workspaces.yaml");
        }
    }

    let server = axum_server::bind(addr).serve(server.into_make_service());
    info!("Server starting on {}", addr);

    // Run server until Ctrl+C, then signal bots to shut down gracefully
    tokio::select! {
        result = server => {
            if let Err(e) = result {
                error!("Server failed: {}", e);
            }
        }
        _ = signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully...");
            shutdown_token.cancel();
            // Give bots a moment to close their WebSocket connections
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }

    Ok(())
}
