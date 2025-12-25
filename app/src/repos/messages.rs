use crate::models::person::Model as Person;
use crate::models::{
    message::{self, ActiveModel, Entity as MessageEntity, Model as Message},
    task,
};
use crate::utils::crypto::generate_uuid;
use migration::query;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter};
use sea_orm::{ActiveValue::Set, QuerySelect, RelationTrait};

pub struct MessagesRepo {
    db: DatabaseConnection,
}

impl MessagesRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        content: String,
        external_id: String,
        channel: String,
        timestamp: String,
        person: &Person,
    ) -> Result<Message, DbErr> {
        let message_model = ActiveModel {
            id: Set(generate_uuid()),
            person_id: Set(person.id.clone()),
            content: Set(content),
            external_id: Set(external_id),
            channel: Set(channel),
            timestamp: Set(timestamp),
        };
        let message = message_model.insert(&self.db).await?;

        Ok(message)
    }

    pub async fn get_all_by_person(&self, person_id: String) -> Result<Vec<Message>, DbErr> {
        let messages = MessageEntity::find()
            .filter(message::Column::PersonId.eq(&person_id))
            .all(&self.db)
            .await?;

        Ok(messages)
    }

    pub async fn get_task_message(&self, task_id: String) -> Result<Message, DbErr> {
        let message = MessageEntity::find()
            .join(
                sea_orm::JoinType::InnerJoin,
                message::Relation::Task.def().rev(),
            )
            .filter(task::Column::Id.eq(task_id))
            .one(&self.db)
            .await?;

        match message {
            Some(mesg) => Ok(mesg),
            None => Err(DbErr::RecordNotFound(
                "Associated task not found for the message".to_string(),
            )),
        }
    }

    pub async fn get_message_by_external_id(&self, external_id: String) -> Result<Message, DbErr> {
        let message = MessageEntity::find()
            .filter(message::Column::ExternalId.eq(external_id.clone()))
            .one(&self.db)
            .await?;

        match message {
            Some(msg) => Ok(msg),
            None => Err(DbErr::RecordNotFound(format!(
                "Message with external_id: {} not found",
                external_id
            ))),
        }
    }

    pub async fn get_by_id(&self, message_id: String) -> Result<Message, DbErr> {
        let message = MessageEntity::find_by_id(&message_id).one(&self.db).await?;

        match message {
            Some(msg) => Ok(msg),
            None => Err(DbErr::RecordNotFound(format!(
                "Message with id: {} not found",
                message_id
            ))),
        }
    }

    pub async fn get_all(&self) -> Result<Vec<Message>, DbErr> {
        let messages = MessageEntity::find().all(&self.db).await?;

        Ok(messages)
    }
}
