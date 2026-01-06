use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Debug, Clone, DeriveEntityModel, PartialEq, Serialize)]
#[sea_orm(table_name = "workspace_links")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub person_id: String,
    pub workspace_name: String,
    pub slack_member_id: Option<String>,
    pub is_linked: bool,
    pub is_active: bool,
    pub created_at: DateTime,
    pub updated_at: Option<DateTime>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::person::Entity",
        from = "Column::PersonId",
        to = "super::person::Column::Id",
        on_delete = "Cascade"
    )]
    Person,
}

impl Related<super::person::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Person.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
