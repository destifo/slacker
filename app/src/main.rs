use std::{
    env,
    net::{IpAddr, SocketAddr},
};

use anyhow::Result;
use dotenvy::dotenv;
use slacker::{config::config::Config, core::server::create_server, sockets::slack_bot::SlackBot};
use tracing::error;

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

    let server = axum_server::bind(addr).serve(server.into_make_service());
    let slack_bot = SlackBot::new(config.clone(), db_conn.clone());
    tokio::select! {
        result = server => {
            if let Err(e) = result {
                error!("Server failed to start with HTTP: {}", e);
            }
        },
        result = slack_bot.start() => {
            if let Err(e) = result {
                error!("Slack bot failed to start: {}", e);
            }
        }
    }

    Ok(())
}
