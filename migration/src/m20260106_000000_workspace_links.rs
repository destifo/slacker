use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(WorkspaceLinks::Table)
                    .if_not_exists()
                    .col(string(WorkspaceLinks::Id).primary_key())
                    .col(string(WorkspaceLinks::PersonId))
                    .col(string(WorkspaceLinks::WorkspaceName))
                    .col(string_null(WorkspaceLinks::SlackMemberId))
                    .col(boolean(WorkspaceLinks::IsLinked).default(false))
                    .col(timestamp(WorkspaceLinks::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp_null(WorkspaceLinks::UpdatedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_workspace_links_person")
                            .from(WorkspaceLinks::Table, WorkspaceLinks::PersonId)
                            .to(Persons::Table, Persons::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .index(
                        Index::create()
                            .unique()
                            .name("idx_person_workspace")
                            .col(WorkspaceLinks::PersonId)
                            .col(WorkspaceLinks::WorkspaceName),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(WorkspaceLinks::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum WorkspaceLinks {
    Table,
    Id,
    PersonId,
    WorkspaceName,
    SlackMemberId,
    IsLinked,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Persons {
    Table,
    Id,
}
