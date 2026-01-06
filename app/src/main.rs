use std::net::{IpAddr, SocketAddr};

use anyhow::Result;
use dotenvy::dotenv;
use slacker::{
    config::{config::Config, workspaces::WorkspacesConfig},
    core::server::create_server,
    sockets::slack_bot::SlackBot,
};
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    dotenv().ok();

    let config = Config::load_envs().expect("Failed to load envs");

    let port: u16 = config.port.clone();
    let server_ip_str: String = config.server_ip.clone();
    let server_ip: IpAddr = server_ip_str.parse().unwrap_or(IpAddr::from([0, 0, 0, 0]));
    let addr = SocketAddr::new(server_ip, port);
    let (server, db_conn) = create_server(config.clone()).await?;

    // Load workspaces and spawn a bot for each
    match WorkspacesConfig::load_from_file("workspaces.yaml") {
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
                );

                tokio::spawn(async move {
                    info!("Starting SlackBot for workspace: {}", workspace_name);
                    if let Err(e) = bot.start().await {
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
    
    if let Err(e) = server.await {
        error!("Server failed: {}", e);
    }

    Ok(())
}
