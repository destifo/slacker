use sea_orm_migration::{
    prelude::{extension::postgres::Type, *},
    schema::*,
};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // TaskStatus data type
        manager
            .create_type(
                Type::create()
                    .as_enum(TaskStatus::Type)
                    .values(vec![
                        TaskStatus::InProgress,
                        TaskStatus::Blocked,
                        TaskStatus::Completed,
                    ])
                    .to_owned(),
            )
            .await?;

        // persons
        manager
            .create_table(
                Table::create()
                    .table("persons")
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(string("name"))
                    .col(string("email"))
                    .col(boolean("is_me"))
                    .col(string("external_id"))
                    .to_owned(),
            )
            .await?;

        // messages
        manager
            .create_table(
                Table::create()
                    .table("messages")
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(string("content"))
                    .col(string("external_id"))
                    .col(string("person_id"))
                    .col(string("timestamp"))
                    .col(string("channel"))
                    .to_owned(),
            )
            .await?;

        // tasks
        manager
            .create_table(
                Table::create()
                    .table("tasks")
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(string("status").not_null())
                    .col(string("assigned_to").not_null())
                    .col(
                        timestamp("created_at")
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(string("message_id"))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_persons")
                            .from("tasks", "assigned_to")
                            .to("persons", "id")
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_tasks_messages")
                            .from("tasks", "message_id")
                            .to("messages", "id")
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // changes
        manager
            .create_table(
                Table::create()
                    .table("changes")
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(string("old"))
                    .col(string("new"))
                    .col(integer("index"))
                    .col(string("task_id"))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_changes_tasks")
                            .from("changes", "task_id")
                            .to("tasks", "id")
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table("tasks").to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table("persons").to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table("messages").to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table("changes").to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
pub enum TaskStatus {
    #[sea_orm(iden = "task_status")]
    Type,
    InProgress,
    Blocked,
    Completed,
}
