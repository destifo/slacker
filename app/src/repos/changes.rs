use sea_orm::ActiveValue::Set;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, PaginatorTrait,
    QueryFilter,
};

use crate::models::change::{self, ActiveModel, Entity as ChangeEntity, Model as Change};
use crate::models::task::{Model as Task, TaskStatus};
use crate::utils::crypto::generate_uuid;

pub struct ChangesRepo {
    db: DatabaseConnection,
}

impl ChangesRepo {
    pub async fn create(&self, old: TaskStatus, task: &Task) -> Result<Change, DbErr> {
        let changes_count = ChangeEntity::find()
            .filter(change::Column::TaskId.eq(&task.id))
            .count(&self.db)
            .await? as i16;

        let change_model = ActiveModel {
            id: Set(generate_uuid()),
            old: Set(old),
            new: Set(task.status.clone()),
            index: Set(changes_count),
            task_id: Set(task.id.clone()),
            ..Default::default()
        };
        let change = change_model.insert(&self.db).await?;

        Ok(change)
    }

    pub async fn get_all_for_task(&self, task_id: String) -> Result<Vec<Change>, DbErr> {
        let changes = ChangeEntity::find()
            .filter(change::Column::TaskId.eq(&task_id))
            .all(&self.db)
            .await?;

        Ok(changes)
    }
}
