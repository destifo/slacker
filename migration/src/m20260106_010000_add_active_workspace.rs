use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(WorkspaceLinks::Table)
                    .add_column(boolean(WorkspaceLinks::IsActive).default(false))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(WorkspaceLinks::Table)
                    .drop_column(WorkspaceLinks::IsActive)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum WorkspaceLinks {
    Table,
    IsActive,
}

