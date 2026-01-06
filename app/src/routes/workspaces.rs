use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    core::state::AppState,
    handlers::workspaces::{
        get_active_workspace, get_workspace_settings, get_workspace_users,
        invite_user_to_workspace, link_workspace, list_workspaces, remove_user_from_workspace,
        reset_emoji_mappings, setup_workspace, switch_workspace, unlink_workspace,
        update_emoji_mappings, update_workspace_tokens,
    },
};

pub fn workspace_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/link", post(link_workspace))
        .route("/unlink", post(unlink_workspace))
        .route("/switch", post(switch_workspace))
        .route("/active", get(get_active_workspace))
        .route("/setup", post(setup_workspace))
        // Settings routes
        .route("/:workspace_name/settings", get(get_workspace_settings))
        .route("/:workspace_name/tokens", put(update_workspace_tokens))
        .route(
            "/:workspace_name/emoji-mappings",
            put(update_emoji_mappings),
        )
        .route(
            "/:workspace_name/emoji-mappings/reset",
            post(reset_emoji_mappings),
        )
        // User management routes
        .route("/:workspace_name/users", get(get_workspace_users))
        .route(
            "/:workspace_name/users/invite",
            post(invite_user_to_workspace),
        )
        .route(
            "/:workspace_name/users/remove",
            post(remove_user_from_workspace),
        )
}
