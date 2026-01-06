use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Represents emoji to status mappings
/// Key: emoji name (e.g., "eyes", "white_check_mark")
/// Value: status string (e.g., "InProgress", "Completed")
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct EmojiMappings {
    #[serde(default)]
    pub in_progress: Vec<String>,
    #[serde(default)]
    pub blocked: Vec<String>,
    #[serde(default)]
    pub completed: Vec<String>,
}

impl EmojiMappings {
    pub fn default_mappings() -> Self {
        Self {
            in_progress: vec!["eyes".to_string()],
            blocked: vec![
                "arrows_counterclockwise".to_string(),
                "loading".to_string(),
                "hourglass".to_string(),
            ],
            completed: vec![
                "white_check_mark".to_string(),
                "heavy_check_mark".to_string(),
            ],
        }
    }
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "workspace_settings")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub workspace_name: String,
    pub emoji_mappings: Json,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    pub fn get_emoji_mappings(&self) -> EmojiMappings {
        serde_json::from_value(self.emoji_mappings.clone())
            .unwrap_or_else(|_| EmojiMappings::default_mappings())
    }
}

