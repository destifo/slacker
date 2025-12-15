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
                    .col(pk_auto("id"))
                    .col(string("name"))
                    .col(boolean("is_me"))
                    .col(string("external_id"))
                    .index(
                        Index::create()
                            .name("persons_external_id_idx")
                            .col("external_id"),
                    )
                    .to_owned(),
            )
            .await?;

        // messages
        manager
            .create_table(
                Table::create()
                    .table("messages")
                    .if_not_exists()
                    .col(pk_auto("id"))
                    .col(string("content"))
                    .col(string("external_id"))
                    .col(string("person_id"))
                    .index(
                        Index::create()
                            .name("messages_external_id_index")
                            .col("external_id"),
                    )
                    .to_owned(),
            )
            .await?;

        // tasks
        manager
            .create_table(
                Table::create()
                    .table("tasks")
                    .if_not_exists()
                    .col(pk_auto("id").not_null())
                    .col(ColumnDef::new(TaskStatus::Type).not_null())
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
                    .col(pk_auto("id"))
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
                    .index(Index::create().name("idx_changes").col(Alias::new("index")))
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
        manager
            .drop_type(Type::drop().name(TaskStatus::Type).to_owned())
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
