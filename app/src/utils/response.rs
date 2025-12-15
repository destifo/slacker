use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Serialize)]
struct Message {
    message: String,
}

pub enum APIResponse {
    OK,
    Created,
    NotFound(String),
    JsonData(Vec<Message>),
}

impl IntoResponse for APIResponse {
    fn into_response(self) -> Response {
        match self {
            Self::OK => (StatusCode::OK).into_response(),
            Self::Created => (StatusCode::CREATED).into_response(),
            Self::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"status": "error", "details": msg})),
            )
                .into_response(),
            Self::JsonData(data) => (StatusCode::OK, Json(data)).into_response(),
        }
    }
}

enum APIError {
    BadRequest,
    UnAuthorized,
    Forbidden,
    MethodNotAllowed,
    InternalServerError,
}

impl IntoResponse for APIError {
    fn into_response(self) -> Response {
        match self {
            Self::BadRequest => (StatusCode::BAD_REQUEST).into_response(),
            Self::UnAuthorized => (StatusCode::UNAUTHORIZED).into_response(),
            Self::Forbidden => (StatusCode::FORBIDDEN).into_response(),
            Self::MethodNotAllowed => (StatusCode::METHOD_NOT_ALLOWED).into_response(),
            Self::InternalServerError => (StatusCode::INTERNAL_SERVER_ERROR).into_response(),
        }
    }
}
