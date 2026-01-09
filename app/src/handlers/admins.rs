use std::sync::Arc;

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::{
    core::state::AppState, models::person::Model as Person,
    repos::workspace_admins::WorkspaceAdminsRepo, utils::response::APIError,
};

#[derive(Debug, Serialize)]
pub struct AdminInfo {
    pub id: String,
    pub email: String,
    pub invited_by: String,
    pub created_at: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct AdminListResponse {
    pub admins: Vec<AdminInfo>,
    pub is_super_admin: bool,
}

#[derive(Debug, Serialize)]
pub struct PermissionCheckResponse {
    pub can_configure_workspaces: bool,
    pub is_super_admin: bool,
    pub has_workspace_access: bool,
}

/// Check if the current user can configure workspaces
pub async fn check_permissions(
    State(state): State<Arc<AppState>>,
    person: Person,
) -> Result<Json<PermissionCheckResponse>, APIError> {
    let is_super_admin = person.email == state.config.admin_email;

    let admins_repo = WorkspaceAdminsRepo::new(state.database.clone());
    let is_invited_admin = admins_repo.is_admin(&person.email).await.unwrap_or(false);

    // Check if user has any workspace links
    let workspace_links_repo =
        crate::repos::workspace_links::WorkspaceLinksRepo::new(state.database.clone());
    let user_links = workspace_links_repo
        .get_by_person(person.id.clone())
        .await
        .unwrap_or_default();
    let has_workspace_access = !user_links.is_empty() && user_links.iter().any(|l| l.is_linked);

    Ok(Json(PermissionCheckResponse {
        can_configure_workspaces: is_super_admin || is_invited_admin,
        is_super_admin,
        has_workspace_access,
    }))
}

/// List all admins (only accessible by super admin or existing admins)
pub async fn list_admins(
    State(state): State<Arc<AppState>>,
    person: Person,
) -> Result<Json<AdminListResponse>, APIError> {
    let is_super_admin = person.email == state.config.admin_email;

    let admins_repo = WorkspaceAdminsRepo::new(state.database.clone());
    let is_invited_admin = admins_repo.is_admin(&person.email).await.unwrap_or(false);

    if !is_super_admin && !is_invited_admin {
        return Err(APIError::Forbidden);
    }

    let admins = admins_repo.get_all_admins().await.map_err(|e| {
        error!("Failed to get admins: {}", e);
        APIError::InternalServerError("Failed to get admins".to_string())
    })?;

    let admin_list: Vec<AdminInfo> = admins
        .into_iter()
        .map(|a| AdminInfo {
            id: a.id,
            email: a.email,
            invited_by: a.invited_by,
            created_at: a.created_at.to_string(),
            is_active: a.is_active,
        })
        .collect();

    Ok(Json(AdminListResponse {
        admins: admin_list,
        is_super_admin,
    }))
}

#[derive(Debug, Deserialize)]
pub struct InviteAdminRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct InviteAdminResponse {
    pub success: bool,
    pub message: String,
    pub admin: Option<AdminInfo>,
}

/// Invite a new admin (only super admin or existing admins can do this)
pub async fn invite_admin(
    State(state): State<Arc<AppState>>,
    person: Person,
    Json(payload): Json<InviteAdminRequest>,
) -> Result<Json<InviteAdminResponse>, APIError> {
    let is_super_admin = person.email == state.config.admin_email;

    let admins_repo = WorkspaceAdminsRepo::new(state.database.clone());
    let is_invited_admin = admins_repo.is_admin(&person.email).await.unwrap_or(false);

    if !is_super_admin && !is_invited_admin {
        return Err(APIError::Forbidden);
    }

    info!(
        "Admin {} inviting new admin: {}",
        person.email, payload.email
    );

    // Check if already an admin
    if let Ok(existing) = admins_repo.get_by_email(&payload.email).await {
        if existing.is_active {
            return Ok(Json(InviteAdminResponse {
                success: false,
                message: format!("'{}' is already an admin", payload.email),
                admin: Some(AdminInfo {
                    id: existing.id,
                    email: existing.email,
                    invited_by: existing.invited_by,
                    created_at: existing.created_at.to_string(),
                    is_active: existing.is_active,
                }),
            }));
        } else {
            // Reactivate
            let reactivated = admins_repo
                .reactivate_admin(&payload.email)
                .await
                .map_err(|e| {
                    error!("Failed to reactivate admin: {}", e);
                    APIError::InternalServerError("Failed to reactivate admin".to_string())
                })?;

            return Ok(Json(InviteAdminResponse {
                success: true,
                message: format!("Reactivated admin access for '{}'", payload.email),
                admin: Some(AdminInfo {
                    id: reactivated.id,
                    email: reactivated.email,
                    invited_by: reactivated.invited_by,
                    created_at: reactivated.created_at.to_string(),
                    is_active: reactivated.is_active,
                }),
            }));
        }
    }

    // Create new admin
    let admin = admins_repo
        .invite_admin(payload.email.clone(), person.email.clone())
        .await
        .map_err(|e| {
            error!("Failed to invite admin: {}", e);
            APIError::InternalServerError("Failed to invite admin".to_string())
        })?;

    info!("Successfully invited {} as admin", payload.email);

    Ok(Json(InviteAdminResponse {
        success: true,
        message: format!("Successfully invited '{}' as an admin", payload.email),
        admin: Some(AdminInfo {
            id: admin.id,
            email: admin.email,
            invited_by: admin.invited_by,
            created_at: admin.created_at.to_string(),
            is_active: admin.is_active,
        }),
    }))
}

#[derive(Debug, Deserialize)]
pub struct RevokeAdminRequest {
    pub email: String,
}

/// Revoke admin access (only super admin or the original inviter can do this)
pub async fn revoke_admin(
    State(state): State<Arc<AppState>>,
    person: Person,
    Json(payload): Json<RevokeAdminRequest>,
) -> Result<Json<InviteAdminResponse>, APIError> {
    let is_super_admin = person.email == state.config.admin_email;

    // Cannot revoke super admin
    if payload.email == state.config.admin_email {
        return Err(APIError::BadRequest(
            "Cannot revoke super admin access".to_string(),
        ));
    }

    let admins_repo = WorkspaceAdminsRepo::new(state.database.clone());

    // Check permissions - super admin can revoke anyone, others can only revoke if they invited
    if !is_super_admin {
        let is_invited_admin = admins_repo.is_admin(&person.email).await.unwrap_or(false);
        if !is_invited_admin {
            return Err(APIError::Forbidden);
        }

        // Check if this admin invited the target
        if let Ok(target_admin) = admins_repo.get_by_email(&payload.email).await {
            if target_admin.invited_by != person.email {
                return Err(APIError::BadRequest(
                    "You can only revoke admins you invited".to_string(),
                ));
            }
        }
    }

    info!(
        "Admin {} revoking admin access for: {}",
        person.email, payload.email
    );

    let revoked = admins_repo
        .revoke_admin(&payload.email)
        .await
        .map_err(|e| {
            error!("Failed to revoke admin: {}", e);
            APIError::BadRequest("Admin not found".to_string())
        })?;

    Ok(Json(InviteAdminResponse {
        success: true,
        message: format!("Revoked admin access for '{}'", payload.email),
        admin: Some(AdminInfo {
            id: revoked.id,
            email: revoked.email,
            invited_by: revoked.invited_by,
            created_at: revoked.created_at.to_string(),
            is_active: revoked.is_active,
        }),
    }))
}

/// Helper function to check if a person can configure workspaces
pub async fn can_configure_workspaces(state: &AppState, email: &str) -> bool {
    if email == state.config.admin_email {
        return true;
    }

    let admins_repo = WorkspaceAdminsRepo::new(state.database.clone());
    admins_repo.is_admin(email).await.unwrap_or(false)
}
