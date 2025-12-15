use sea_orm::entity::prelude::*;

use crate::models::task::TaskStatus;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "changes")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub old: TaskStatus,
    pub new: TaskStatus,
    pub index: i16,
    pub task_id: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::task::Entity",
        from = "Column::TaskId",
        to = "super::task::Column::Id"
    )]
    Task,
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Task.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
