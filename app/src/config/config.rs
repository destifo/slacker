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

    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,

    /// Frontend URL for OAuth callback redirects
    #[serde(default = "default_frontend_url")]
    pub frontend_url: String,

    pub jwt_secret: String,
    #[serde(default = "default_jwt_expiry")]
    pub jwt_expiry_hours: i64,

    /// Master key for encrypting workspace tokens
    /// IMPORTANT: Keep this secret and don't lose it!
    #[serde(default = "default_encryption_key")]
    pub encryption_key: String,
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

fn default_jwt_expiry() -> i64 {
    168
}

fn default_frontend_url() -> String {
    "http://localhost:5173".to_string()
}

fn default_encryption_key() -> String {
    // WARNING: This default is insecure! Set ENCRYPTION_KEY in production!
    "change-this-default-encryption-key-in-production".to_string()
}

impl Config {
    pub fn load_envs() -> Result<Self, envy::Error> {
        envy::from_env()
    }
}
