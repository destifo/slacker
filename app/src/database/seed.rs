use sea_orm::{DatabaseConnection, DbErr};
use tracing::info;

use crate::{config::config::Config, repos::persons::PersonsRepo};

pub async fn seed_default_user(db: &DatabaseConnection, config: &Config) -> Result<(), DbErr> {
    let person_repo = PersonsRepo::new(db.clone());
    let existing = person_repo
        .get_by_external_id(config.slack_member_id.clone())
        .await;
    if existing.is_ok() {
        info!("Default user already exists");
        return Ok(());
    }

    let _person = person_repo
        .create(
            config.user_name.clone(),
            true,
            config.slack_member_id.clone(),
            config.user_email.clone(),
        )
        .await?;
    info!("Created default user: {}", config.user_name);

    Ok(())
}
