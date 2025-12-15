use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)")]
pub enum TaskStatus {
    #[sea_orm(string_value = "InProgress")]
    InProgress,
    #[sea_orm(string_value = "Blocked")]
    Blocked,
    #[sea_orm(string_value = "Completed")]
    Completed,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: String,
    pub status: TaskStatus,
    pub assigned_to: String,
    pub created_at: DateTime,
    pub message_id: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::person::Entity",
        from = "Column::AssignedTo",
        to = "super::person::Column::Id"
    )]
    Person,
    #[sea_orm(has_many = "super::change::Entity")]
    Change,
    #[sea_orm(
        belongs_to = "super::message::Entity"
        from = "Column::MessageId",
        to = "super::message::Column::Id",
        on_delete = "Cascade"
    )]
    Message,
}

impl Related<super::person::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Person.def()
    }
}

impl Related<super::change::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Change.def()
    }
}

impl Related<super::message::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Message.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
