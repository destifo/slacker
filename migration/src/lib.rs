pub use sea_orm_migration::prelude::*;

mod m20251214_173322_first_migration;
mod m20260106_000000_workspace_links;
mod m20260106_010000_add_active_workspace;
mod m20260106_020000_workspace_settings;
mod m20260109_000000_add_assigned_by;
mod m20260109_010000_workspace_admins;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20251214_173322_first_migration::Migration),
            Box::new(m20260106_000000_workspace_links::Migration),
            Box::new(m20260106_010000_add_active_workspace::Migration),
            Box::new(m20260106_020000_workspace_settings::Migration),
            Box::new(m20260109_000000_add_assigned_by::Migration),
            Box::new(m20260109_010000_workspace_admins::Migration),
        ]
    }
}
