pub mod auth;
pub mod tasks;

use std::sync::Arc;

use axum::{middleware, Router};

use crate::{
    core::state::AppState,
    middlewares::auth::require_auth,
    routes::{auth::auth_routes, tasks::task_routes},
    utils::global_error_handler::global_error_handler,
};

pub fn create_routers(state: Arc<AppState>) -> Router<()> {
    let public_routes = Router::new().nest("/auth", auth_routes());

    let protected_routes = Router::new()
        .nest("/tasks", task_routes())
        .nest("/auth", protected_auth_routes())
        .layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .nest("/api", public_routes.merge(protected_routes))
        .fallback(global_error_handler)
        .with_state(state)
}

fn protected_auth_routes() -> Router<Arc<AppState>> {
    use crate::handlers::auth::get_me;
    use axum::routing::get;

    Router::new().route("/me", get(get_me))
}
