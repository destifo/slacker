use crate::{
    models::{
        message::Model as Message,
        person::Model as Person,
        task::{self, ActiveModel, Entity as TaskEntity, Model as Task, TaskStatus},
    },
    utils::crypto::generate_uuid,
};
use sea_orm::{
    prelude::DateTime, ActiveModelTrait, ActiveValue::Set, ColumnTrait, Condition,
    DatabaseConnection, DbErr, EntityTrait, QueryFilter,
};

pub struct TasksRepo {
    pub db: DatabaseConnection,
}

impl TasksRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        status: TaskStatus,
        assigned_to: Person,
        assigned_by: Option<Person>,
        created_at: DateTime,
        message: Message,
    ) -> Result<Task, DbErr> {
        let task_model = ActiveModel {
            id: Set(generate_uuid()),
            status: Set(status),
            assigned_to: Set(assigned_to.id.clone()),
            assigned_by: Set(assigned_by.map(|p| p.id)),
            created_at: Set(created_at),
            message_id: Set(message.id.clone()),
        };
        let task = task_model.insert(&self.db).await?;

        Ok(task)
    }

    pub async fn get(&self, task_id: String) -> Result<Task, DbErr> {
        let task = TaskEntity::find_by_id(task_id).one(&self.db).await?;

        match task {
            Some(t) => Ok(t),
            None => Err(DbErr::RecordNotFound("Task was not found".to_string())),
        }
    }

    pub async fn get_assigned(&self, person_id: String) -> Result<Vec<Task>, DbErr> {
        let tasks = TaskEntity::find()
            .filter(task::Column::AssignedTo.eq(&person_id))
            .all(&self.db)
            .await?;

        Ok(tasks)
    }

    pub async fn change_status(&self, task_id: String, status: TaskStatus) -> Result<Task, DbErr> {
        let task = TaskEntity::find_by_id(&task_id)
            .one(&self.db)
            .await?
            .ok_or(DbErr::RecordNotFound("Task was not found.".to_string()))?;

        let mut task: ActiveModel = task.into();
        task.status = Set(status);
        let updated_task = task.update(&self.db).await?;

        Ok(updated_task)
    }

    pub async fn get_task_by_message_id(&self, message_id: String) -> Result<Task, DbErr> {
        let task = TaskEntity::find()
            .filter(task::Column::MessageId.eq(&message_id))
            .one(&self.db)
            .await?;

        match task {
            Some(t) => Ok(t),
            None => Err(DbErr::RecordNotFound("Task was not found".to_string())),
        }
    }

    pub async fn get_all_tasks(&self) -> Result<Vec<Task>, DbErr> {
        let tasks = TaskEntity::find().all(&self.db).await?;

        Ok(tasks)
    }

    pub async fn get_tasks_by_person_id(&self, person_id: String) -> Result<Vec<Task>, DbErr> {
        let tasks = TaskEntity::find()
            .filter(task::Column::AssignedTo.eq(person_id))
            .all(&self.db)
            .await?;

        Ok(tasks)
    }

    pub async fn get_initiated_by(&self, person_id: String) -> Result<Vec<Task>, DbErr> {
        let tasks = TaskEntity::find()
            .filter(task::Column::AssignedBy.eq(person_id))
            .all(&self.db)
            .await?;

        Ok(tasks)
    }

    /// Get tasks assigned to a person but initiated by someone else
    /// (excludes self-reactions and tasks with unknown initiator)
    pub async fn get_assigned_by_others(&self, person_id: String) -> Result<Vec<Task>, DbErr> {
        let tasks = TaskEntity::find()
            .filter(task::Column::AssignedTo.eq(&person_id))
            .filter(task::Column::AssignedBy.is_not_null())
            .filter(task::Column::AssignedBy.ne(&person_id))
            .all(&self.db)
            .await?;

        Ok(tasks)
    }
}
