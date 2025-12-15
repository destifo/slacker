pub use sea_orm_migration::prelude::*;

mod m20251214_173322_first_migration;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20251214_173322_first_migration::Migration)]
    }
}
