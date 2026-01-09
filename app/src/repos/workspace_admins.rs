use crate::{
    models::workspace_admin::{
        self, ActiveModel, Entity as WorkspaceAdminEntity, Model as WorkspaceAdmin,
    },
    utils::crypto::generate_uuid,
};
use sea_orm::sqlx::types::chrono;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait,
    QueryFilter,
};

pub struct WorkspaceAdminsRepo {
    pub db: DatabaseConnection,
}

impl WorkspaceAdminsRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Check if an email is an admin (can configure workspaces)
    pub async fn is_admin(&self, email: &str) -> Result<bool, DbErr> {
        let admin = WorkspaceAdminEntity::find()
            .filter(workspace_admin::Column::Email.eq(email))
            .filter(workspace_admin::Column::IsActive.eq(true))
            .one(&self.db)
            .await?;

        Ok(admin.is_some())
    }

    /// Get admin by email
    pub async fn get_by_email(&self, email: &str) -> Result<WorkspaceAdmin, DbErr> {
        WorkspaceAdminEntity::find()
            .filter(workspace_admin::Column::Email.eq(email))
            .one(&self.db)
            .await?
            .ok_or(DbErr::RecordNotFound("Admin not found".to_string()))
    }

    /// Invite a new admin
    pub async fn invite_admin(
        &self,
        email: String,
        invited_by: String,
    ) -> Result<WorkspaceAdmin, DbErr> {
        let admin = ActiveModel {
            id: Set(generate_uuid()),
            email: Set(email),
            invited_by: Set(invited_by),
            created_at: Set(chrono::Utc::now().naive_utc()),
            is_active: Set(true),
        };

        admin.insert(&self.db).await
    }

    /// Revoke admin access (soft delete by setting is_active = false)
    pub async fn revoke_admin(&self, email: &str) -> Result<WorkspaceAdmin, DbErr> {
        let admin = self.get_by_email(email).await?;

        let mut admin_model: ActiveModel = admin.into();
        admin_model.is_active = Set(false);

        admin_model.update(&self.db).await
    }

    /// Reactivate admin access
    pub async fn reactivate_admin(&self, email: &str) -> Result<WorkspaceAdmin, DbErr> {
        let admin = self.get_by_email(email).await?;

        let mut admin_model: ActiveModel = admin.into();
        admin_model.is_active = Set(true);

        admin_model.update(&self.db).await
    }

    /// Get all admins
    pub async fn get_all_admins(&self) -> Result<Vec<WorkspaceAdmin>, DbErr> {
        WorkspaceAdminEntity::find().all(&self.db).await
    }

    /// Get all active admins
    pub async fn get_active_admins(&self) -> Result<Vec<WorkspaceAdmin>, DbErr> {
        WorkspaceAdminEntity::find()
            .filter(workspace_admin::Column::IsActive.eq(true))
            .all(&self.db)
            .await
    }

    /// Delete admin permanently
    pub async fn delete_admin(&self, email: &str) -> Result<(), DbErr> {
        WorkspaceAdminEntity::delete_many()
            .filter(workspace_admin::Column::Email.eq(email))
            .exec(&self.db)
            .await?;

        Ok(())
    }
}
