use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use tracing::error;

use crate::{
    core::state::AppState,
    repos::persons::PersonsRepo,
    utils::{jwt::verify_jwt, response::APIError},
};

pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(tok) if tok.starts_with("Bearer ") => &tok[7..],
        _ => {
            error!("Auth Failed, Missing or invalid authorization header");
            return APIError::UnAuthorized.into_response();
        }
    };

    let claims = match verify_jwt(token, &state.config.jwt_secret) {
        Ok(c) => c,
        Err(e) => {
            error!("Auth Failed, Invalid token: {}", e);
            return APIError::UnAuthorized.into_response();
        }
    };

    let persons_repo = PersonsRepo::new(state.database.clone());
    let person = match persons_repo.get_by_email(claims.sub).await {
        Ok(p) => p,
        Err(e) => {
            error!("User not found: {}", e);
            return APIError::UnAuthorized.into_response();
        }
    };

    request.extensions_mut().insert(person);
    next.run(request).await
}
