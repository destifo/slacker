use crate::models::person::Model as Person;
use crate::models::{
    message::{self, ActiveModel, Entity as MessageEntity, Model as Message},
    task,
};
use crate::utils::crypto::generate_uuid;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter};
use sea_orm::{ActiveValue::Set, QuerySelect, RelationTrait};

pub struct MessagesRepo {
    db: DatabaseConnection,
}

impl MessagesRepo {
    pub async fn create(
        &self,
        content: String,
        external_id: String,
        person: &Person,
    ) -> Result<Message, DbErr> {
        let message_model = ActiveModel {
            id: Set(generate_uuid()),
            person_id: Set(person.id.clone()),
            content: Set(content),
            external_id: Set(external_id),
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
}
