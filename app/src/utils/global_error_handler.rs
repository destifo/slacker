use crate::utils::response::APIResponse;

pub async fn global_error_handler() -> APIResponse {
    APIResponse::NotFound("Not Found".to_string())
}
