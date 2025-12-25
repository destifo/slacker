use anyhow::Result;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

use axum::Router;

use crate::{
    config::config::Config,
    core::state::AppState,
    database::{
        connect::{connect_database, run_migrations},
        seed::seed_default_user,
    },
    routes::create_routers,
};

pub async fn create_server(config: Config) -> Result<(Router<()>, DatabaseConnection)> {
    let db_conn = connect_database(config.clone()).await?;
    run_migrations(&db_conn).await?;
    seed_default_user(&db_conn, &config).await?;

    let state = AppState {
        database: db_conn.clone(),
        config,
    };

    let app = create_routers(Arc::new(state));

    Ok((app, db_conn))
}
