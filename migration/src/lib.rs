pub use sea_orm_migration::prelude::*;

mod m20251214_173322_first_migration;
mod m20260106_000000_workspace_links;
mod m20260106_010000_add_active_workspace;
mod m20260106_020000_workspace_settings;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20251214_173322_first_migration::Migration),
            Box::new(m20260106_000000_workspace_links::Migration),
            Box::new(m20260106_010000_add_active_workspace::Migration),
            Box::new(m20260106_020000_workspace_settings::Migration),
        ]
    }
}
