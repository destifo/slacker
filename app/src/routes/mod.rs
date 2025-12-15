pub mod tasks;

use std::sync::Arc;

use axum::Router;

use crate::{core::state::AppState, utils::global_error_handler::global_error_handler};

pub fn create_routers(state: Arc<AppState>) -> Router<()> {
    Router::new()
        .merge(other)
        .with_state(state)
        .fallback(global_error_handler())
}
