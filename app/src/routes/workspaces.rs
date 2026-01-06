use axum::{routing::{get, post}, Router};
use std::sync::Arc;

use crate::{core::state::AppState, handlers::workspaces::{get_active_workspace, link_workspace, list_workspaces, switch_workspace, unlink_workspace}};

pub fn workspace_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/link", post(link_workspace))
        .route("/unlink", post(unlink_workspace))
        .route("/switch", post(switch_workspace))
        .route("/active", get(get_active_workspace))
}

