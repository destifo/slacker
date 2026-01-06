use std::sync::Arc;

use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use axum::extract::Query;
use crate::{
    config::workspaces::{WorkspaceConfig, WorkspacesConfig},
    core::state::AppState,
    models::{person::Model as Person, workspace_link::Model as WorkspaceLink, workspace_settings::EmojiMappings},
    repos::{workspace_links::WorkspaceLinksRepo, workspace_settings::WorkspaceSettingsRepo, persons::PersonsRepo},
    services::user::fetch_user_by_email_with_config,
    utils::{response::APIError, crypto::generate_uuid},
};

#[derive(Debug, Serialize)]
pub struct WorkspaceInfo {
    name: String,
    is_linked: bool,
    is_active: bool,
    slack_member_id: Option<String>,
    is_bot_connected: bool,
    bot_connected_at: Option<String>,
    bot_last_heartbeat: Option<String>,
    bot_error: Option<String>,
    is_syncing: bool,
    sync_progress: Option<String>,
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
    // Load and decrypt workspaces from YAML
    let workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key).map_err(|e| {
        error!("Failed to load workspaces config: {}", e);
        APIError::InternalServerError("Failed to load workspaces configuration".to_string())
    })?;

    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    let user_links = workspace_links_repo
        .get_by_person(person.id.clone())
        .await
        .unwrap_or_default();

    // Get all bot statuses
    let bot_statuses = state.bot_status.get_all_statuses().await;

    let workspace_names = workspaces_config.list_workspaces();
    let workspaces: Vec<WorkspaceInfo> = workspace_names
        .iter()
        .map(|name| {
            let link = user_links.iter().find(|l| &l.workspace_name == name);
            let bot_status = bot_statuses.iter().find(|s| &s.workspace_name == name);
            
            WorkspaceInfo {
                name: name.clone(),
                is_linked: link.map(|l| l.is_linked).unwrap_or(false),
                is_active: link.map(|l| l.is_active).unwrap_or(false),
                slack_member_id: link.and_then(|l| l.slack_member_id.clone()),
                is_bot_connected: bot_status.map(|s| s.is_connected).unwrap_or(false),
                bot_connected_at: bot_status.and_then(|s| s.connected_at.map(|t| t.to_rfc3339())),
                bot_last_heartbeat: bot_status.and_then(|s| s.last_heartbeat.map(|t| t.to_rfc3339())),
                bot_error: bot_status.and_then(|s| s.error_message.clone()),
                is_syncing: bot_status.map(|s| s.is_syncing).unwrap_or(false),
                sync_progress: bot_status.and_then(|s| s.sync_progress.clone()),
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

    // Load and decrypt workspace config
    let workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key).map_err(|e| {
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
        .link_workspace(person.id.clone(), payload.workspace_name.clone(), slack_member_id.clone())
        .await
        .map_err(|e| {
            error!("Failed to link workspace: {}", e);
            APIError::InternalServerError("Failed to link workspace".to_string())
        })?;

    // Update person's external_id with Slack member ID if not already set
    if person.external_id.is_empty() {
        let persons_repo = PersonsRepo::new(state.database.clone());
        if let Err(e) = persons_repo.update_external_id(person.id.clone(), slack_member_id.clone()).await {
            error!("Failed to update person's external_id: {}", e);
            // Don't fail the request, just log the error
        } else {
            info!("Updated person's external_id to {}", slack_member_id);
        }
    }

    // Trigger initial sync in the background
    let workspace_name = payload.workspace_name.clone();
    let bot_token = workspace_config.bot_token.clone();
    let db = state.database.clone();
    let bot_status = state.bot_status.clone();
    let member_id = slack_member_id.clone();
    
    tokio::spawn(async move {
        let syncer = crate::sockets::slack_bot::InitialSyncer::new(
            workspace_name.clone(),
            bot_token,
            db,
            bot_status,
        );
        
        info!("Starting initial sync for newly linked workspace: {}", workspace_name);
        if let Err(e) = syncer.perform_initial_sync(&member_id).await {
            error!("Initial sync failed for workspace {}: {}", workspace_name, e);
        }
    });

    Ok(Json(LinkWorkspaceResponse {
        success: true,
        message: format!("Successfully linked to workspace '{}'. Syncing your data...", payload.workspace_name),
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

#[derive(Debug, Deserialize)]
pub struct SetupWorkspaceRequest {
    workspace_name: String,
    app_token: String,
    bot_token: String,
}

#[derive(Debug, Serialize)]
pub struct SetupWorkspaceResponse {
    success: bool,
    message: String,
}

/// Setup a new workspace - REQUIRES AUTHENTICATION
/// Tokens are encrypted before being stored
pub async fn setup_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,  // Requires auth!
    Json(payload): Json<SetupWorkspaceRequest>,
) -> Result<Json<SetupWorkspaceResponse>, APIError> {
    info!("User {} setting up workspace: {}", person.email, payload.workspace_name);

    // Validate tokens
    if !payload.app_token.starts_with("xapp-") {
        return Err(APIError::BadRequest("Invalid app token format. Should start with 'xapp-'".to_string()));
    }
    if !payload.bot_token.starts_with("xoxb-") {
        return Err(APIError::BadRequest("Invalid bot token format. Should start with 'xoxb-'".to_string()));
    }

    // Load and decrypt existing config (to avoid double-encrypting existing tokens)
    let mut workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
        .unwrap_or_else(|_| WorkspacesConfig::new());

    // Clone tokens for bot spawning before moving into config
    let app_token_for_bot = payload.app_token.clone();
    let bot_token_for_bot = payload.bot_token.clone();

    // Add workspace with plain tokens (will be encrypted on save)
    workspaces_config.add_workspace(
        payload.workspace_name.clone(),
        WorkspaceConfig {
            app_token: payload.app_token,
            bot_token: payload.bot_token,
        },
    );

    // Save with encryption
    workspaces_config
        .save_encrypted("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to save workspaces config: {}", e);
            APIError::InternalServerError("Failed to save workspace configuration".to_string())
        })?;

    info!("Workspace '{}' configured and encrypted successfully", payload.workspace_name);

    // Dynamically spawn the bot for this workspace
    state.spawn_bot(
        payload.workspace_name.clone(),
        app_token_for_bot,
        bot_token_for_bot,
    );

    Ok(Json(SetupWorkspaceResponse {
        success: true,
        message: format!("Workspace '{}' configured and bot started successfully!", payload.workspace_name),
    }))
}

// ============== Workspace Settings ==============

#[derive(Debug, Serialize)]
pub struct WorkspaceSettingsResponse {
    pub workspace_name: String,
    pub emoji_mappings: EmojiMappings,
    pub has_app_token: bool,
    pub has_bot_token: bool,
}

/// Get workspace settings including emoji mappings
pub async fn get_workspace_settings(
    State(state): State<Arc<AppState>>,
    _person: Person,
    Path(workspace_name): Path<String>,
) -> Result<Json<WorkspaceSettingsResponse>, APIError> {
    // Check if workspace exists
    let workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to load workspaces config: {}", e);
            APIError::InternalServerError("Failed to load workspaces configuration".to_string())
        })?;

    let workspace_config = workspaces_config.get_workspace(&workspace_name);
    if workspace_config.is_none() {
        return Err(APIError::NotFound(format!("Workspace '{}' not found", workspace_name)));
    }

    let config = workspace_config.unwrap();

    // Get emoji mappings from database
    let settings_repo = WorkspaceSettingsRepo::new(state.database.clone());
    let emoji_mappings = settings_repo.get_emoji_mappings(&workspace_name).await
        .map_err(|e| {
            error!("Failed to get workspace settings: {}", e);
            APIError::InternalServerError("Failed to get workspace settings".to_string())
        })?;

    Ok(Json(WorkspaceSettingsResponse {
        workspace_name,
        emoji_mappings,
        has_app_token: !config.app_token.is_empty(),
        has_bot_token: !config.bot_token.is_empty(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateTokenRequest {
    pub app_token: Option<String>,
    pub bot_token: Option<String>,
}

/// Update workspace tokens (app_token and/or bot_token)
pub async fn update_workspace_tokens(
    State(state): State<Arc<AppState>>,
    person: Person,
    Path(workspace_name): Path<String>,
    Json(payload): Json<UpdateTokenRequest>,
) -> Result<Json<SetupWorkspaceResponse>, APIError> {
    info!("User {} updating tokens for workspace: {}", person.email, workspace_name);

    // Validate tokens if provided
    if let Some(ref app_token) = payload.app_token {
        if !app_token.starts_with("xapp-") {
            return Err(APIError::BadRequest("Invalid app token format. Should start with 'xapp-'".to_string()));
        }
    }
    if let Some(ref bot_token) = payload.bot_token {
        if !bot_token.starts_with("xoxb-") {
            return Err(APIError::BadRequest("Invalid bot token format. Should start with 'xoxb-'".to_string()));
        }
    }

    // Load existing config
    let mut workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to load workspaces config: {}", e);
            APIError::InternalServerError("Failed to load workspaces configuration".to_string())
        })?;

    let existing_config = workspaces_config.get_workspace(&workspace_name)
        .ok_or_else(|| APIError::NotFound(format!("Workspace '{}' not found", workspace_name)))?
        .clone();

    // Update tokens
    let updated_config = WorkspaceConfig {
        app_token: payload.app_token.unwrap_or(existing_config.app_token),
        bot_token: payload.bot_token.unwrap_or(existing_config.bot_token),
    };

    workspaces_config.add_workspace(workspace_name.clone(), updated_config);

    // Save with encryption
    workspaces_config
        .save_encrypted("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to save workspaces config: {}", e);
            APIError::InternalServerError("Failed to save workspace configuration".to_string())
        })?;

    info!("Workspace '{}' tokens updated successfully", workspace_name);

    Ok(Json(SetupWorkspaceResponse {
        success: true,
        message: format!("Tokens updated for workspace '{}'. Restart the server to apply changes.", workspace_name),
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmojiMappingsRequest {
    pub emoji_mappings: EmojiMappings,
}

/// Update emoji to status mappings for a workspace
pub async fn update_emoji_mappings(
    State(state): State<Arc<AppState>>,
    person: Person,
    Path(workspace_name): Path<String>,
    Json(payload): Json<UpdateEmojiMappingsRequest>,
) -> Result<Json<WorkspaceSettingsResponse>, APIError> {
    info!("User {} updating emoji mappings for workspace: {}", person.email, workspace_name);

    // Check if workspace exists
    let workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to load workspaces config: {}", e);
            APIError::InternalServerError("Failed to load workspaces configuration".to_string())
        })?;

    if workspaces_config.get_workspace(&workspace_name).is_none() {
        return Err(APIError::NotFound(format!("Workspace '{}' not found", workspace_name)));
    }

    // Update emoji mappings in database
    let settings_repo = WorkspaceSettingsRepo::new(state.database.clone());
    let settings = settings_repo.update_emoji_mappings(&workspace_name, payload.emoji_mappings.clone()).await
        .map_err(|e| {
            error!("Failed to update emoji mappings: {}", e);
            APIError::InternalServerError("Failed to update emoji mappings".to_string())
        })?;

    info!("Emoji mappings updated for workspace '{}'", workspace_name);

    Ok(Json(WorkspaceSettingsResponse {
        workspace_name,
        emoji_mappings: settings.get_emoji_mappings(),
        has_app_token: true,
        has_bot_token: true,
    }))
}

/// Reset emoji mappings to defaults
pub async fn reset_emoji_mappings(
    State(state): State<Arc<AppState>>,
    person: Person,
    Path(workspace_name): Path<String>,
) -> Result<Json<WorkspaceSettingsResponse>, APIError> {
    info!("User {} resetting emoji mappings for workspace: {}", person.email, workspace_name);

    let default_mappings = EmojiMappings::default_mappings();

    let settings_repo = WorkspaceSettingsRepo::new(state.database.clone());
    let settings = settings_repo.update_emoji_mappings(&workspace_name, default_mappings).await
        .map_err(|e| {
            error!("Failed to reset emoji mappings: {}", e);
            APIError::InternalServerError("Failed to reset emoji mappings".to_string())
        })?;

    Ok(Json(WorkspaceSettingsResponse {
        workspace_name,
        emoji_mappings: settings.get_emoji_mappings(),
        has_app_token: true,
        has_bot_token: true,
    }))
}

// ============== Workspace Users ==============

#[derive(Debug, Serialize)]
pub struct WorkspaceUserInfo {
    pub id: String,
    pub name: String,
    pub email: String,
    pub slack_member_id: Option<String>,
    pub is_active: bool,
    pub linked_at: String,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceUsersResponse {
    pub users: Vec<WorkspaceUserInfo>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub page: Option<u64>,
    pub per_page: Option<u64>,
}

/// Get paginated list of users in a workspace
pub async fn get_workspace_users(
    State(state): State<Arc<AppState>>,
    _person: Person,
    Path(workspace_name): Path<String>,
    Query(pagination): Query<PaginationQuery>,
) -> Result<Json<WorkspaceUsersResponse>, APIError> {
    let page = pagination.page.unwrap_or(0);
    let per_page = pagination.per_page.unwrap_or(10).min(100);

    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    
    let (users_with_links, total) = workspace_links_repo
        .get_workspace_users_paginated(workspace_name.clone(), page, per_page)
        .await
        .map_err(|e| {
            error!("Failed to get workspace users: {}", e);
            APIError::InternalServerError("Failed to get workspace users".to_string())
        })?;

    let users: Vec<WorkspaceUserInfo> = users_with_links
        .into_iter()
        .map(|(link, person)| WorkspaceUserInfo {
            id: person.id,
            name: person.name,
            email: person.email,
            slack_member_id: link.slack_member_id,
            is_active: link.is_active,
            linked_at: link.created_at.to_string(),
        })
        .collect();

    let total_pages = (total as f64 / per_page as f64).ceil() as u64;

    Ok(Json(WorkspaceUsersResponse {
        users,
        total,
        page,
        per_page,
        total_pages,
    }))
}

#[derive(Debug, Deserialize)]
pub struct InviteUserRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct InviteUserResponse {
    pub success: bool,
    pub message: String,
    pub user: Option<WorkspaceUserInfo>,
}

/// Invite a user to a workspace by email
/// Validates that the user exists in the Slack workspace before adding
pub async fn invite_user_to_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
    Path(workspace_name): Path<String>,
    Json(payload): Json<InviteUserRequest>,
) -> Result<Json<InviteUserResponse>, APIError> {
    info!("User {} inviting {} to workspace {}", person.email, payload.email, workspace_name);

    // Load workspace config to get bot token
    let workspaces_config = WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
        .map_err(|e| {
            error!("Failed to load workspaces config: {}", e);
            APIError::InternalServerError("Failed to load workspaces configuration".to_string())
        })?;

    let workspace_config = workspaces_config
        .get_workspace(&workspace_name)
        .ok_or_else(|| APIError::NotFound(format!("Workspace '{}' not found", workspace_name)))?;

    // Check if user exists in Slack workspace
    let (slack_member_id, slack_name) = match fetch_user_by_email_with_config(
        &workspace_config.bot_token,
        &state.config.google_client_id,
        &payload.email,
    ).await {
        Ok(result) => result,
        Err(e) => {
            error!("User not found in Slack: {}", e);
            return Ok(Json(InviteUserResponse {
                success: false,
                message: format!("User with email '{}' was not found in this Slack workspace. They need to be a member of the Slack workspace first.", payload.email),
                user: None,
            }));
        }
    };

    info!("Found Slack user: {} ({})", slack_name, slack_member_id);

    // Check if person exists in our database
    let persons_repo = PersonsRepo::new(state.database.clone());
    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());

    let person_model = match persons_repo.get_by_email(payload.email.clone()).await {
        Ok(p) => p,
        Err(_) => {
            // Create new person
            info!("Creating new person for invited user: {}", payload.email);
            persons_repo.create(
                slack_name.clone(),
                false, // is_me - false for invited users
                slack_member_id.clone(),
                payload.email.clone(),
            ).await.map_err(|e| {
                error!("Failed to create person: {}", e);
                APIError::InternalServerError("Failed to create user".to_string())
            })?
        }
    };

    // Check if already linked
    if let Ok(existing_link) = workspace_links_repo
        .get_by_person_and_workspace(person_model.id.clone(), workspace_name.clone())
        .await
    {
        if existing_link.is_linked {
            return Ok(Json(InviteUserResponse {
                success: false,
                message: format!("User '{}' is already a member of this workspace", payload.email),
                user: Some(WorkspaceUserInfo {
                    id: person_model.id,
                    name: person_model.name,
                    email: person_model.email,
                    slack_member_id: existing_link.slack_member_id,
                    is_active: existing_link.is_active,
                    linked_at: existing_link.created_at.to_string(),
                }),
            }));
        }
    }

    // Create workspace link
    let link = workspace_links_repo
        .link_workspace(person_model.id.clone(), workspace_name.clone(), slack_member_id.clone())
        .await
        .map_err(|e| {
            error!("Failed to link user to workspace: {}", e);
            APIError::InternalServerError("Failed to add user to workspace".to_string())
        })?;

    info!("Successfully invited {} to workspace {}", payload.email, workspace_name);

    Ok(Json(InviteUserResponse {
        success: true,
        message: format!("Successfully added '{}' to the workspace", payload.email),
        user: Some(WorkspaceUserInfo {
            id: person_model.id,
            name: person_model.name,
            email: person_model.email,
            slack_member_id: link.slack_member_id,
            is_active: link.is_active,
            linked_at: link.created_at.to_string(),
        }),
    }))
}

#[derive(Debug, Deserialize)]
pub struct RemoveUserRequest {
    pub user_id: String,
}

/// Remove a user from a workspace
pub async fn remove_user_from_workspace(
    State(state): State<Arc<AppState>>,
    person: Person,
    Path(workspace_name): Path<String>,
    Json(payload): Json<RemoveUserRequest>,
) -> Result<Json<InviteUserResponse>, APIError> {
    info!("User {} removing user {} from workspace {}", person.email, payload.user_id, workspace_name);

    let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
    
    workspace_links_repo
        .unlink_workspace(payload.user_id.clone(), workspace_name.clone())
        .await
        .map_err(|e| {
            error!("Failed to remove user from workspace: {}", e);
            APIError::BadRequest("User not found in this workspace".to_string())
        })?;

    Ok(Json(InviteUserResponse {
        success: true,
        message: "User removed from workspace".to_string(),
        user: None,
    }))
}
