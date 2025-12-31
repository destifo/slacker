use std::sync::Arc;

use crate::{
    core::state::AppState,
    models::person::Model as Person,
    repos::persons::PersonsRepo,
    services::user::fetch_user_by_email,
    utils::{
        jwt::create_jwt,
        response::{APIError, APIResponse},
    },
};
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
    Json,
};
use migration::query;
use reqwest::Client;
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    token: String,
    person: Person,
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
) -> Result<Json<AuthResponse>, APIError> {
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

            let (slack_member_id, slack_name) =
                fetch_user_by_email(&state.config, &http_client, &user_info.email)
                    .await
                    .map_err(|e| {
                        error!("User not found in slack workspace: {}", e);
                        APIError::BadRequest(format!(
                            "Email {} is not part of slack workspace",
                            &user_info.email
                        ))
                    })?;

            let name = if slack_name.is_empty() {
                user_info.name
            } else {
                slack_name
            };

            person_repo
                .create(name, false, slack_member_id, user_info.email.clone())
                .await
                .map_err(|e| {
                    error!("Failed to create person entity: {}", e);
                    APIError::InternalServerError("Failed to create person entity".to_string())
                })?
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

    Ok(Json(AuthResponse { token, person }))
}
