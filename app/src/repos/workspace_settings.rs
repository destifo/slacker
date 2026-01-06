use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, Set,
};
use serde_json::json;

use crate::models::workspace_settings::{
    ActiveModel, Column, EmojiMappings, Entity as WorkspaceSettingsEntity, Model as WorkspaceSettings,
};

pub struct WorkspaceSettingsRepo {
    db: DatabaseConnection,
}

impl WorkspaceSettingsRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn get_by_workspace(&self, workspace_name: &str) -> Result<Option<WorkspaceSettings>, DbErr> {
        WorkspaceSettingsEntity::find()
            .filter(Column::WorkspaceName.eq(workspace_name))
            .one(&self.db)
            .await
    }

    pub async fn get_or_create(&self, workspace_name: &str) -> Result<WorkspaceSettings, DbErr> {
        if let Some(settings) = self.get_by_workspace(workspace_name).await? {
            return Ok(settings);
        }

        // Create with default mappings
        let default_mappings = EmojiMappings::default_mappings();
        let id = nanoid::nanoid!();
        let now = chrono::Utc::now().naive_utc();

        let model = ActiveModel {
            id: Set(id),
            workspace_name: Set(workspace_name.to_string()),
            emoji_mappings: Set(json!(default_mappings)),
            created_at: Set(now),
            updated_at: Set(now),
        };

        model.insert(&self.db).await
    }

    pub async fn update_emoji_mappings(
        &self,
        workspace_name: &str,
        mappings: EmojiMappings,
    ) -> Result<WorkspaceSettings, DbErr> {
        let settings = self.get_or_create(workspace_name).await?;
        let now = chrono::Utc::now().naive_utc();

        let model = ActiveModel {
            id: Set(settings.id),
            workspace_name: Set(workspace_name.to_string()),
            emoji_mappings: Set(json!(mappings)),
            created_at: Set(settings.created_at),
            updated_at: Set(now),
        };

        model.update(&self.db).await
    }

    pub async fn get_emoji_mappings(&self, workspace_name: &str) -> Result<EmojiMappings, DbErr> {
        let settings = self.get_or_create(workspace_name).await?;
        Ok(settings.get_emoji_mappings())
    }
}

