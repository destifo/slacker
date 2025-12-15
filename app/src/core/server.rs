use anyhow::Result;
use std::sync::Arc;

use axum::Router;

use crate::{core::state::AppState, database::connect::connect_database, routes::create_routers};

pub async fn create_server() -> Result<Router<()>> {
    let db_conn = connect_database().await?;

    let state = AppState { database: db_conn };

    let app = create_routers(Arc::new(state));

    Ok(app)
}
