use std::sync::Arc;

use crate::{
    core::state::AppState,
    models::{change::Model as Change, person::Model as Person, task::TaskStatus},
    repos::{
        changes::ChangesRepo, messages::MessagesRepo, tasks::TasksRepo,
        workspace_links::WorkspaceLinksRepo,
    },
    utils::response::{APIError, APIResponse},
};
use axum::{
    extract::{Path, State},
    Extension,
};
use serde::Serialize;
use tracing::warn;

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

#[derive(Debug, Serialize)]
pub struct MessageDetail {
    pub id: String,
    pub content: String,
    pub external_id: String,
    pub channel: String,
    pub timestamp: String,
    pub slack_link: String,
}

#[derive(Debug, Serialize)]
pub struct TaskDetailResponse {
    pub id: String,
    pub status: TaskStatus,
    pub assigned_to: String,
    pub created_at: String,
    pub message: MessageDetail,
    pub changes: Vec<Change>,
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

pub async fn get_tasks_board(
    State(state): State<Arc<AppState>>,
    Extension(person): Extension<Person>,
) -> Result<APIResponse, APIError> {
    let tasks_repo = TasksRepo::new(state.database.clone());
    let messages_repo = MessagesRepo::new(state.database.clone());
    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());

    // Get active workspace for the user
    let active_workspace = match workspace_links_repo
        .get_active_workspace(person.id.clone())
        .await
    {
        Ok(workspace) => workspace,
        Err(_) => {
            warn!("User {} has no active workspace", person.email);
            return Ok(APIResponse::json(TaskBoard {
                in_progress: vec![],
                blocked: vec![],
                completed: vec![],
            }));
        }
    };

    // Get all tasks (we'll filter by workspace on person level)
    let all_tasks = tasks_repo.get_all_tasks().await?;
    let mut board = TaskBoard {
        in_progress: vec![],
        blocked: vec![],
        completed: vec![],
    };

    for task in all_tasks {
        // Only include tasks where the assigned person is linked to the active workspace
        let person_workspace = workspace_links_repo
            .get_by_person_and_workspace(
                task.assigned_to.clone(),
                active_workspace.workspace_name.clone(),
            )
            .await;

        // Skip if person not linked to this workspace
        if person_workspace.is_err() || !person_workspace.as_ref().unwrap().is_linked {
            continue;
        }

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

pub async fn get_task_detail(
    State(state): State<Arc<AppState>>,
    Extension(_person): Extension<Person>,
    Path(task_id): Path<String>,
) -> Result<APIResponse, APIError> {
    let tasks_repo = TasksRepo::new(state.database.clone());
    let messages_repo = MessagesRepo::new(state.database.clone());
    let changes_repo = ChangesRepo::new(state.database.clone());

    // Get task
    let task = tasks_repo
        .get(task_id.clone())
        .await
        .map_err(|_| APIError::NotFound("Task not found".to_string()))?;

    // Get message
    let message = messages_repo.get_by_id(task.message_id.clone()).await?;

    // Get change history
    let changes = changes_repo
        .get_all_for_task(task_id)
        .await
        .unwrap_or_default();

    // Construct Slack link
    // Format: https://slack.com/archives/{channel}/p{timestamp_without_dot}
    let timestamp_for_link = message.timestamp.replace(".", "");
    let slack_link = format!(
        "https://slack.com/archives/{}/p{}",
        message.channel, timestamp_for_link
    );

    let response = TaskDetailResponse {
        id: task.id,
        status: task.status,
        assigned_to: task.assigned_to,
        created_at: task.created_at.to_string(),
        message: MessageDetail {
            id: message.id,
            content: message.content,
            external_id: message.external_id,
            channel: message.channel,
            timestamp: message.timestamp,
            slack_link,
        },
        changes,
    };

    Ok(APIResponse::json(response))
}
