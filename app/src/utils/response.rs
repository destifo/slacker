use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use sea_orm::DbErr;
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Serialize)]
struct Message {
    message: String,
}

pub enum APIResponse {
    OK,
    Created,
    NotFound(String),
    JsonData(JsonValue),
}

impl APIResponse {
    pub fn json<T: Serialize>(data: T) -> Self {
        APIResponse::JsonData(serde_json::to_value(data).unwrap_or(JsonValue::Null))
    }
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

pub enum APIError {
    BadRequest(String),
    NotFound(String),
    UnAuthorized,
    Forbidden,
    MethodNotAllowed,
    InternalServerError(String),
}

impl IntoResponse for APIError {
    fn into_response(self) -> Response {
        match self {
            Self::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "status": "error", "detail": msg,
                })),
            )
                .into_response(),
            Self::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"status": "error", "detail": msg,})),
            )
                .into_response(),
            Self::UnAuthorized => (StatusCode::UNAUTHORIZED).into_response(),
            Self::Forbidden => (StatusCode::FORBIDDEN).into_response(),
            Self::MethodNotAllowed => (StatusCode::METHOD_NOT_ALLOWED).into_response(),
            Self::InternalServerError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "status": "error",
                    "message": msg
                })),
            )
                .into_response(),
        }
    }
}

impl From<DbErr> for APIError {
    fn from(err: DbErr) -> Self {
        match err {
            DbErr::RecordNotFound(msg) => APIError::NotFound(msg),
            _ => APIError::InternalServerError(err.to_string()),
        }
    }
}
