use std::sync::Arc;

use crate::{
    config::workspaces::WorkspacesConfig,
    core::state::AppState,
    models::person::Model as Person,
    repos::{persons::PersonsRepo, workspace_links::WorkspaceLinksRepo},
    services::user::fetch_user_by_email_with_config,
    utils::{jwt::create_jwt, response::APIError},
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use reqwest::Client;
use serde::Deserialize;
use tracing::{error, info};

#[derive(Debug, Deserialize)]
pub struct GoogleCallbackQuery {
    code: String,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    email: String,
    name: String,
    picture: Option<String>,
}

pub async fn google_login(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile",
        state.config.google_client_id,
        urlencoding::encode(&state.config.google_redirect_uri)
    );

    Redirect::temporary(&auth_url)
}

pub async fn google_callback(
    State(state): State<Arc<AppState>>,
    Query(query): Query<GoogleCallbackQuery>,
) -> Result<Redirect, APIError> {
    let http_client = Client::new();

    let token_response = http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", query.code.as_str()),
            ("client_id", state.config.google_client_id.as_str()),
            ("client_secret", state.config.google_client_secret.as_str()),
            ("redirect_uri", state.config.google_redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| {
            error!("Failed to exchange code: {}", e);
            APIError::InternalServerError("Failed to authenticate with Google".to_string())
        })?
        .json::<GoogleTokenResponse>()
        .await
        .map_err(|e| {
            error!("Failed to parse token response: {}", e);
            APIError::InternalServerError("Failed to authenticate with Google".to_string())
        })?;

    let user_info = http_client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(&token_response.access_token)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to get user info: {}", e);
            APIError::InternalServerError("Failed to get the user info".to_string())
        })?
        .json::<GoogleUserInfo>()
        .await
        .map_err(|e| {
            error!("Failed to parse user info response: {}", e);
            APIError::InternalServerError("Failed to get the user info".to_string())
        })?;

    info!(
        "User authenticated: {} ({})",
        &user_info.name, &user_info.email
    );

    let person_repo = PersonsRepo::new(state.database.clone());

    let person = match person_repo.get_by_email(user_info.email.clone()).await {
        Ok(p) => {
            info!("Existing user logged in: {}", user_info.name);
            p
        }
        Err(_) => {
            info!("Signing up unregistered user: {}", user_info.name);

            // Try to load workspaces config - it's OK if none exist
            let workspaces_config =
                WorkspacesConfig::load_and_decrypt("workspaces.yaml", &state.config.encryption_key)
                    .ok();

            let workspace_names = workspaces_config
                .as_ref()
                .map(|c| c.list_workspaces())
                .unwrap_or_default();

            // Try to find user in any workspace (if workspaces exist)
            let mut found_workspace: Option<(String, String, String)> = None;
            if let Some(ref config) = workspaces_config {
                for workspace_name in workspace_names.iter() {
                    if let Some(workspace_config) = config.get_workspace(workspace_name) {
                        if let Ok((slack_member_id, slack_name)) = fetch_user_by_email_with_config(
                            &workspace_config.bot_token,
                            &state.config.google_client_id,
                            &user_info.email,
                        )
                        .await
                        {
                            found_workspace =
                                Some((workspace_name.clone(), slack_member_id, slack_name));
                            break;
                        }
                    }
                }
            }

            // Create person - use Slack name if found, otherwise Google name
            let (name, slack_member_id) = match &found_workspace {
                Some((_, member_id, slack_name)) => {
                    let name = if slack_name.is_empty() {
                        user_info.name.clone()
                    } else {
                        slack_name.clone()
                    };
                    (name, member_id.clone())
                }
                None => (user_info.name.clone(), String::new()),
            };

            let created_person = person_repo
                .create(
                    name,
                    false,
                    slack_member_id.clone(),
                    user_info.email.clone(),
                )
                .await
                .map_err(|e| {
                    error!("Failed to create person entity: {}", e);
                    APIError::InternalServerError("Failed to create person entity".to_string())
                })?;

            // Auto-link to the workspace where they were found (if any)
            if let Some((workspace_name, slack_member_id, _)) = found_workspace {
                let workspace_links_repo = WorkspaceLinksRepo::new(state.database.clone());
                if let Err(e) = workspace_links_repo
                    .link_workspace(
                        created_person.id.clone(),
                        workspace_name.clone(),
                        slack_member_id,
                    )
                    .await
                {
                    // Log but don't fail - user can link manually later
                    error!("Failed to auto-link workspace: {}", e);
                } else {
                    info!(
                        "Auto-linked {} to workspace: {}",
                        user_info.email, workspace_name
                    );
                }
            } else {
                info!(
                    "No workspace found for {}. User can configure workspaces later.",
                    user_info.email
                );
            }

            created_person
        }
    };

    let token = create_jwt(
        user_info.email.clone(),
        person.id.clone(),
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )
    .map_err(|e| {
        error!("Failed to create JWT: {}", e);
        APIError::InternalServerError("Failed to create session".to_string())
    })?;

    // Redirect to frontend with auth data
    let redirect_url = format!(
        "{}/auth/callback?token={}&name={}&email={}",
        state.config.frontend_url.trim_end_matches('/'),
        urlencoding::encode(&token),
        urlencoding::encode(&person.name),
        urlencoding::encode(&person.email)
    );

    Ok(Redirect::temporary(&redirect_url))
}

pub async fn get_me(person: Person) -> Result<Json<Person>, StatusCode> {
    Ok(Json(person))
}
