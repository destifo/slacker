use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};

use crate::{
    core::state::AppState,
    handlers::admins::{check_permissions, invite_admin, list_admins, revoke_admin},
};

pub fn admin_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/permissions", get(check_permissions))
        .route("/", get(list_admins))
        .route("/invite", post(invite_admin))
        .route("/revoke", post(revoke_admin))
}
