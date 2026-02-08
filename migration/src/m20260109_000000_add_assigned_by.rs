use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add assigned_by column to tasks table (nullable initially for existing records)
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("tasks"))
                    .add_column(ColumnDef::new(Alias::new("assigned_by")).string().null())
                    .add_foreign_key(
                        TableForeignKey::new()
                            .name("fk_tasks_assigned_by")
                            .from_col(Alias::new("assigned_by"))
                            .to_tbl(Alias::new("persons"))
                            .to_col(Alias::new("id"))
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // For existing tasks, set assigned_by to be the same as assigned_to
        manager
            .get_connection()
            .execute_unprepared(
                "UPDATE tasks SET assigned_by = assigned_to WHERE assigned_by IS NULL",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("tasks"))
                    .drop_foreign_key(Alias::new("fk_tasks_assigned_by"))
                    .drop_column(Alias::new("assigned_by"))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
