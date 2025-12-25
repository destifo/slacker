use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database_url: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_server_ip")]
    pub server_ip: String,

    #[serde(default = "default_max_connections")]
    pub max_connections: u32,

    #[serde(default = "default_min_connections")]
    pub min_connections: u32,

    pub app_id: String,
    pub client_id: String,
    pub client_secret: String,
    pub signing_secret: String,
    pub verification_token: String,
    pub bot_token: String,
    pub app_token: String,

    pub user_email: String,
    pub user_name: String,
    pub slack_member_id: String,
}

fn default_port() -> u16 {
    8000
}
fn default_server_ip() -> String {
    "127.0.0.1".to_string()
}
fn default_max_connections() -> u32 {
    10
}
fn default_min_connections() -> u32 {
    2
}

impl Config {
    pub fn load_envs() -> Result<Self, envy::Error> {
        envy::from_env()
    }
}
