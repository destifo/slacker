use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create workspace_admins table to track who can configure workspaces
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("workspace_admins"))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Alias::new("email")).string().not_null())
                    .col(
                        ColumnDef::new(Alias::new("invited_by"))
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("created_at"))
                            .timestamp()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Alias::new("is_active"))
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .to_owned(),
            )
            .await?;

        // Create unique index on email
        manager
            .create_index(
                Index::create()
                    .name("idx_workspace_admins_email")
                    .table(Alias::new("workspace_admins"))
                    .col(Alias::new("email"))
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Alias::new("workspace_admins")).to_owned())
            .await?;

        Ok(())
    }
}
