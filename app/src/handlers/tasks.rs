use std::sync::Arc;

use crate::{
    core::state::AppState,
    models::{person::Model as Person, task::TaskStatus},
    repos::{messages::MessagesRepo, tasks::TasksRepo},
    utils::response::{APIError, APIResponse},
};
use axum::{extract::State, Extension};
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct MessageSummary {
    pub id: String,
    pub content: String,
    pub external_id: String,
}

#[derive(Debug, Serialize)]
pub struct TaskResponse {
    pub id: String,
    pub status: TaskStatus,
    pub assigned_to: String,
    pub created_at: String,
    pub message: MessageSummary,
}

#[derive(Debug, Serialize)]
pub struct TaskBoard {
    pub in_progress: Vec<TaskResponse>,
    pub blocked: Vec<TaskResponse>,
    pub completed: Vec<TaskResponse>,
}

pub async fn get_my_tasks(
    State(state): State<Arc<AppState>>,
    Extension(person): Extension<Person>,
) -> Result<APIResponse, APIError> {
    let tasks_repo = TasksRepo {
        db: state.database.clone(),
    };

    let tasks = tasks_repo.get_assigned(person.id).await?;
    let response = APIResponse::json(tasks);

    Ok(response)
}

pub async fn get_tasks_board(State(state): State<Arc<AppState>>) -> Result<APIResponse, APIError> {
    let tasks_repo = TasksRepo::new(state.database.clone());
    let messages_repo = MessagesRepo::new(state.database.clone());

    let all_tasks = tasks_repo.get_all_tasks().await?;
    let mut board = TaskBoard {
        in_progress: vec![],
        blocked: vec![],
        completed: vec![],
    };

    for task in all_tasks {
        let message = messages_repo.get_by_id(task.message_id.clone()).await?;

        let task_response = TaskResponse {
            id: task.id.clone(),
            status: task.status.clone(),
            assigned_to: task.assigned_to.clone(),
            created_at: task.created_at.to_string(),
            message: MessageSummary {
                id: message.id,
                content: message.content,
                external_id: message.external_id,
            },
        };

        match task.status {
            TaskStatus::InProgress => board.in_progress.push(task_response),
            TaskStatus::Blocked => board.blocked.push(task_response),
            TaskStatus::Completed => board.completed.push(task_response),
            TaskStatus::Blank => {}
        };
    }

    Ok(APIResponse::json(board))
}
