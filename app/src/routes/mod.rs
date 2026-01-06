pub mod auth;
pub mod tasks;
pub mod workspaces;

use std::sync::Arc;

use axum::{middleware, Router};
use tower_http::services::{ServeDir, ServeFile};

use crate::{
    core::state::AppState,
    middlewares::auth::require_auth,
    routes::{auth::auth_routes, tasks::task_routes, workspaces::workspace_routes},
};

pub fn create_routers(state: Arc<AppState>) -> Router<()> {
    let public_routes = Router::new()
        .nest("/auth", auth_routes());

    let protected_routes = Router::new()
        .nest("/tasks", task_routes())
        .nest("/workspaces", workspace_routes())
        .nest("/auth", protected_auth_routes())
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    // Serve static files from the frontend build directory
    // Falls back to index.html for SPA routing
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "./static".to_string());
    let index_file = format!("{}/index.html", static_dir);
    
    let serve_dir = ServeDir::new(&static_dir)
        .not_found_service(ServeFile::new(&index_file));

    Router::new()
        .nest("/api", public_routes.merge(protected_routes))
        .fallback_service(serve_dir)
        .with_state(state)
}

fn protected_auth_routes() -> Router<Arc<AppState>> {
    use crate::handlers::auth::get_me;
    use axum::routing::get;

    Router::new().route("/me", get(get_me))
}
