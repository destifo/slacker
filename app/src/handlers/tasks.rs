use std::sync::Arc;

use crate::{
    core::state::AppState, models::person::Entity as Person, repos::tasks::TasksRepo,
    utils::response::APIResponse,
};
use axum::{extract::State, Extension};

pub async fn get_my_tasks(
    State(state): State<Arc<AppState>>,
    Extension(Person): Extension<Person>,
) -> APIResponse {
    let tasks_repo = TasksRepo {
        db: state.database.clone(),
    };
    

    Ok(())
}
