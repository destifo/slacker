use std::sync::Arc;

use axum::{routing::get, Router};

use crate::{
    core::state::AppState,
    handlers::tasks::{get_my_tasks, get_tasks_board},
};

pub fn task_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_my_tasks))
        .route("/board", get(get_tasks_board))
}
