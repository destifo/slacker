use std::{
    env,
    net::{IpAddr, SocketAddr},
};

use anyhow::Result;
use slacker::core::server::create_server;

#[tokio::main]
async fn main() -> Result<()> {
    let port: u16 = env::var("PORT").unwrap_or(8000);
    let server_ip: IpAddr = env::var("SERVER_IP").unwrap_or("127.0.0.1");
    let addr = SocketAddr::new(ip, port);
    let server = create_server().await?;

    let server = axum_server::bind(addr).serve(server.into_make_service());
    tokio::select! {
        result = server => {
            if let Err(e) = result {
                error!("Server failed to start with HTTP: {}", e);
            }
        }
    }

    Ok(())
}
