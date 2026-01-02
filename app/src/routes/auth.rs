use std::sync::Arc;

use axum::{routing::get, Router};

use crate::{
    core::state::AppState,
    handlers::auth::{google_callback, google_login},
};

pub fn auth_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/google", get(google_login))
        .route("/google/callback", get(google_callback))
}
