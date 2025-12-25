pub mod tasks;

use std::sync::Arc;

use axum::{middleware, Router};

use crate::{
    core::state::AppState, middlewares::user::inject_user, routes::tasks::task_routes,
    utils::global_error_handler::global_error_handler,
};

pub fn create_routers(state: Arc<AppState>) -> Router<()> {
    let all_routers = Router::new()
        .nest("/tasks", task_routes())
        .layer(middleware::from_fn_with_state(state.clone(), inject_user))
        .fallback(global_error_handler);

    Router::new().nest("/api", all_routers).with_state(state)
}
