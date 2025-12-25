use migration::{Migrator, MigratorTrait};
use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use std::{env, time::Duration};
use thiserror::Error;

use crate::config::config::Config;

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("Environment Error: {0}")]
    EnvError(String),

    #[error("Connection Error: {0}")]
    ConnectionError(#[from] DbErr),

    #[error("FileSystem Error: {0}")]
    FileSystemError(String),

    #[error("Configuraiton Error: {0}")]
    ConfigError(String),

    #[error("Migration Error: {0}")]
    MigrationError(String),
}

pub async fn connect_database(config: Config) -> Result<DatabaseConnection, DatabaseError> {
    let database_url = config.database_url;

    if !database_url.starts_with("postgres://") {
        return Err(DatabaseError::ConfigError(
            "Invalid Database URL - It must start with postgres://".to_string(),
        ));
    }

    let max_connections: u32 = config.max_connections;
    let min_connections: u32 = config.min_connections;

    let mut opt = ConnectOptions::new(&database_url);
    opt.max_connections(max_connections)
        .min_connections(min_connections)
        .connect_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .sqlx_logging(true);

    let db = Database::connect(opt)
        .await
        .map_err(|e| DatabaseError::ConnectionError(e))?;

    Ok(db)
}

pub async fn run_migrations(connection: &DatabaseConnection) -> Result<(), DatabaseError> {
    Migrator::up(connection, None).await?;

    Ok(())
}

