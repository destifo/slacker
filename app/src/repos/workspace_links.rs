use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait,
    QueryFilter,
};

use crate::{
    models::workspace_link::{self, ActiveModel, Entity as WorkspaceLinkEntity, Model as WorkspaceLink},
    utils::crypto::generate_uuid,
};

pub struct WorkspaceLinksRepo {
    db: DatabaseConnection,
}

impl WorkspaceLinksRepo {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        person_id: String,
        workspace_name: String,
    ) -> Result<WorkspaceLink, DbErr> {
        let link_model = ActiveModel {
            id: Set(generate_uuid()),
            person_id: Set(person_id),
            workspace_name: Set(workspace_name),
            slack_member_id: Set(None),
            is_linked: Set(false),
            is_active: Set(false),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(None),
        };

        let link = link_model.insert(&self.db).await?;
        Ok(link)
    }

    pub async fn get_by_person(&self, person_id: String) -> Result<Vec<WorkspaceLink>, DbErr> {
        let links = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::PersonId.eq(&person_id))
            .all(&self.db)
            .await?;

        Ok(links)
    }

    pub async fn get_by_person_and_workspace(
        &self,
        person_id: String,
        workspace_name: String,
    ) -> Result<WorkspaceLink, DbErr> {
        let link = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::PersonId.eq(&person_id))
            .filter(workspace_link::Column::WorkspaceName.eq(&workspace_name))
            .one(&self.db)
            .await?;

        match link {
            Some(l) => Ok(l),
            None => Err(DbErr::RecordNotFound(
                "Workspace link not found".to_string(),
            )),
        }
    }

    pub async fn link_workspace(
        &self,
        person_id: String,
        workspace_name: String,
        slack_member_id: String,
    ) -> Result<WorkspaceLink, DbErr> {
        // Try to get existing link
        match self
            .get_by_person_and_workspace(person_id.clone(), workspace_name.clone())
            .await
        {
            Ok(link) => {
                // Update existing
                let mut link: ActiveModel = link.into();
                link.slack_member_id = Set(Some(slack_member_id));
                link.is_linked = Set(true);
                link.updated_at = Set(Some(chrono::Utc::now().naive_utc()));
                link.update(&self.db).await
            }
            Err(_) => {
                // Create new - make it active if it's the first link
                let existing_links = self.get_by_person(person_id.clone()).await?;
                let is_first = existing_links.is_empty();

                let link_model = ActiveModel {
                    id: Set(generate_uuid()),
                    person_id: Set(person_id),
                    workspace_name: Set(workspace_name),
                    slack_member_id: Set(Some(slack_member_id)),
                    is_linked: Set(true),
                    is_active: Set(is_first), // Auto-activate if first workspace
                    created_at: Set(chrono::Utc::now().naive_utc()),
                    updated_at: Set(None),
                };
                link_model.insert(&self.db).await
            }
        }
    }

    pub async fn unlink_workspace(
        &self,
        person_id: String,
        workspace_name: String,
    ) -> Result<WorkspaceLink, DbErr> {
        let link = self
            .get_by_person_and_workspace(person_id, workspace_name)
            .await?;

        let mut link: ActiveModel = link.into();
        link.is_linked = Set(false);
        link.slack_member_id = Set(None);
        link.updated_at = Set(Some(chrono::Utc::now().naive_utc()));
        link.update(&self.db).await
    }

    pub async fn delete(&self, link_id: String) -> Result<(), DbErr> {
        WorkspaceLinkEntity::delete_by_id(link_id)
            .exec(&self.db)
            .await?;
        Ok(())
    }

    pub async fn get_active_workspace(&self, person_id: String) -> Result<WorkspaceLink, DbErr> {
        let link = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::PersonId.eq(&person_id))
            .filter(workspace_link::Column::IsActive.eq(true))
            .one(&self.db)
            .await?;

        match link {
            Some(l) => Ok(l),
            None => Err(DbErr::RecordNotFound(
                "No active workspace found".to_string(),
            )),
        }
    }

    pub async fn set_active_workspace(
        &self,
        person_id: String,
        workspace_name: String,
    ) -> Result<WorkspaceLink, DbErr> {
        // Deactivate all workspaces for this user
        let all_links = self.get_by_person(person_id.clone()).await?;
        for link in all_links {
            let mut link: ActiveModel = link.into();
            link.is_active = Set(false);
            link.update(&self.db).await?;
        }

        // Activate the selected workspace
        let link = self
            .get_by_person_and_workspace(person_id, workspace_name)
            .await?;

        let mut link: ActiveModel = link.into();
        link.is_active = Set(true);
        link.updated_at = Set(Some(chrono::Utc::now().naive_utc()));
        link.update(&self.db).await
    }
}

