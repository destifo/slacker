use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{
    config::workspaces::WorkspacesConfig,
    core::state::AppState,
    models::{person::Model as Person, workspace_link::Model as WorkspaceLink},
    repos::workspace_links::WorkspaceLinksRepo,
    services::user::fetch_user_by_email_with_config,
    utils::response::APIError,
};

#[derive(Debug, Serialize)]
pub struct WorkspaceInfo {
    name: String,
    is_linked: bool,
    is_active: bool,
    slack_member_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceListResponse {
    workspaces: Vec<WorkspaceInfo>,
}

#[derive(Debug, Deserialize)]
pub struct LinkWorkspaceRequest {
    workspace_name: String,
}

#[derive(Debug, Serialize)]
pub struct LinkWorkspaceResponse {
    success: bool,
    message: String,
    link: Option<WorkspaceLink>,
}

pub async fn list_workspaces(
    State(state): State<Arc<AppState>>,
    person: Person,
) -> Result<Json<WorkspaceListResponse>, APIError> {
    // Load workspaces from YAML
    let workspaces_config = WorkspacesConfig::load_from_file("workspaces.yaml").map_err(|e| {
        error!("Failed to load workspaces config: {}", e);
        APIError::InternalServerError("Failed to load workspaces configuration".to_string())
    })?;

    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    let user_links = workspace_links_repo
        .get_by_person(person.id.clone())
        .await
        .unwrap_or_default();

    let workspace_names = workspaces_config.list_workspaces();
    let workspaces: Vec<WorkspaceInfo> = workspace_names
        .iter()
        .map(|name| {
            let link = user_links.iter().find(|l| &l.workspace_name == name);
            WorkspaceInfo {
                name: name.clone(),
                is_linked: link.map(|l| l.is_linked).unwrap_or(false),
                is_active: link.map(|l| l.is_active).unwrap_or(false),
                slack_member_id: link.and_then(|l| l.slack_member_id.clone()),
            }
        })
        .collect();

    Ok(Json(WorkspaceListResponse { workspaces }))
}

pub async fn link_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
    Json(payload): Json<LinkWorkspaceRequest>,
) -> Result<Json<LinkWorkspaceResponse>, APIError> {
    info!(
        "Attempting to link {} to workspace: {}",
        person.email, payload.workspace_name
    );

    // Load workspace config
    let workspaces_config = WorkspacesConfig::load_from_file("workspaces.yaml").map_err(|e| {
        error!("Failed to load workspaces config: {}", e);
        APIError::InternalServerError("Failed to load workspaces configuration".to_string())
    })?;

    let workspace_config = workspaces_config
        .get_workspace(&payload.workspace_name)
        .ok_or_else(|| APIError::BadRequest("Workspace not found".to_string()))?;

    // Debug: log token prefix to verify it's loading correctly
    info!(
        "Using bot_token starting with: {}...",
        &workspace_config.bot_token.chars().take(15).collect::<String>()
    );

    // Check if user exists in this Slack workspace
    let (slack_member_id, _slack_name) = fetch_user_by_email_with_config(
        &workspace_config.bot_token,
        &state.config.google_client_id,
        &person.email,
    )
    .await
    .map_err(|e| {
        error!("User not found in Slack workspace: {}", e);
        APIError::BadRequest(format!(
            "Email {} is not found in workspace '{}'",
            person.email, payload.workspace_name
        ))
    })?;

    // Link the workspace
    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    let link = workspace_links_repo
        .link_workspace(person.id.clone(), payload.workspace_name.clone(), slack_member_id)
        .await
        .map_err(|e| {
            error!("Failed to link workspace: {}", e);
            APIError::InternalServerError("Failed to link workspace".to_string())
        })?;

    Ok(Json(LinkWorkspaceResponse {
        success: true,
        message: format!("Successfully linked to workspace '{}'", payload.workspace_name),
        link: Some(link),
    }))
}

pub async fn unlink_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
    Json(payload): Json<LinkWorkspaceRequest>,
) -> Result<Json<LinkWorkspaceResponse>, APIError> {
    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    
    workspace_links_repo
        .unlink_workspace(person.id, payload.workspace_name.clone())
        .await
        .map_err(|e| {
            error!("Failed to unlink workspace: {}", e);
            APIError::InternalServerError("Failed to unlink workspace".to_string())
        })?;

    Ok(Json(LinkWorkspaceResponse {
        success: true,
        message: format!("Successfully unlinked from workspace '{}'", payload.workspace_name),
        link: None,
    }))
}

pub async fn switch_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
    Json(payload): Json<LinkWorkspaceRequest>,
) -> Result<Json<LinkWorkspaceResponse>, APIError> {
    info!(
        "Switching {} to workspace: {}",
        person.email, payload.workspace_name
    );

    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    
    let link = workspace_links_repo
        .set_active_workspace(person.id, payload.workspace_name.clone())
        .await
        .map_err(|e| {
            error!("Failed to switch workspace: {}", e);
            APIError::BadRequest("Workspace not linked or not found".to_string())
        })?;

    Ok(Json(LinkWorkspaceResponse {
        success: true,
        message: format!("Switched to workspace '{}'", payload.workspace_name),
        link: Some(link),
    }))
}

pub async fn get_active_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
) -> Result<Json<Option<WorkspaceLink>>, APIError> {
    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    
    match workspace_links_repo.get_active_workspace(person.id).await {
        Ok(link) => Ok(Json(Some(link))),
        Err(_) => Ok(Json(None)),
    }
}

