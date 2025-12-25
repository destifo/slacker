use sea_orm::DatabaseConnection;

use crate::config::config::Config;

#[derive(Clone, Debug)]
pub struct AppState {
    pub database: DatabaseConnection,
    pub config: Config,
}
