use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(WorkspaceSettings::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(WorkspaceSettings::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(WorkspaceSettings::WorkspaceName)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(WorkspaceSettings::EmojiMappings)
                            .json()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(WorkspaceSettings::CreatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(WorkspaceSettings::UpdatedAt)
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(WorkspaceSettings::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum WorkspaceSettings {
    Table,
    Id,
    WorkspaceName,
    EmojiMappings,
    CreatedAt,
    UpdatedAt,
}

