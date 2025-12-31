use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait,
    QueryFilter,
};

use crate::{
    models::person::{self, ActiveModel, Entity as PersonEntity, Model as Person},
    utils::crypto::generate_uuid,
};

pub struct PersonsRepo {
    db: DatabaseConnection,
}

impl PersonsRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        name: String,
        is_me: bool,
        external_id: String,
        email: String,
    ) -> Result<Person, DbErr> {
        let person_model = ActiveModel {
            id: Set(generate_uuid()),
            name: Set(name),
            is_me: Set(is_me),
            external_id: Set(external_id),
            email: Set(email),
        };

        let person = person_model.insert(&self.db).await?;

        Ok(person)
    }

    pub async fn get_by_external_id(&self, external_id: String) -> Result<Person, DbErr> {
        let person = PersonEntity::find()
            .filter(person::Column::ExternalId.eq(&external_id))
            .one(&self.db)
            .await?;

        match person {
            Some(p) => Ok(p),
            None => Err(DbErr::RecordNotFound("Person not found".to_string())),
        }
    }

    pub async fn get_by_username(&self, username: String) -> Result<Person, DbErr> {
        let person = PersonEntity::find()
            .filter(person::Column::Name.eq(username.clone()))
            .one(&self.db)
            .await?;

        match person {
            Some(p) => Ok(p),
            None => Err(DbErr::RecordNotFound(format!(
                "Person with username {} not found",
                username
            ))),
        }
    }

    pub async fn get_by_email(&self, email: String) -> Result<Person, DbErr> {
        let person = PersonEntity::find()
            .filter(person::Column::Email.eq(&email))
            .one(&self.db)
            .await?;

        match person {
            Some(p) => Ok(p),
            None => Err(DbErr::RecordNotFound(format!(
                "Person with the email {} not found",
                email
            ))),
        }
    }
}
