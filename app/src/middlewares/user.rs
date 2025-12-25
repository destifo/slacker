use std::sync::Arc;

use axum::{
    body::Body,
    extract::State,
    http::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::{core::state::AppState, repos::persons::PersonsRepo, utils::response::APIError};

pub async fn inject_user(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let repo = PersonsRepo::new(state.database.clone());

    let slack_member_id = state.config.slack_member_id.clone();

    match repo.get_by_external_id(slack_member_id).await {
        Ok(person) => {
            request.extensions_mut().insert(person);
            next.run(request).await
        }
        Err(_) => APIError::InternalServerError(
            "Default user not found. Make sure it's configured.".to_string(),
        )
        .into_response(),
    }
}
