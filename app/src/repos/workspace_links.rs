use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, DbErr, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder,
};

use crate::{
    models::person::{Entity as PersonEntity, Model as Person},
    models::workspace_link::{
        self, ActiveModel, Entity as WorkspaceLinkEntity, Model as WorkspaceLink,
    },
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

    /// Get a workspace link by Slack member ID and workspace name
    pub async fn get_by_slack_member_id_and_workspace(
        &self,
        slack_member_id: String,
        workspace_name: String,
    ) -> Result<WorkspaceLink, DbErr> {
        let link = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::SlackMemberId.eq(Some(slack_member_id)))
            .filter(workspace_link::Column::WorkspaceName.eq(&workspace_name))
            .filter(workspace_link::Column::IsLinked.eq(true))
            .one(&self.db)
            .await?;

        match link {
            Some(l) => Ok(l),
            None => Err(DbErr::RecordNotFound(
                "Workspace link not found for this Slack member".to_string(),
            )),
        }
    }

    /// Get all links for a workspace (used to find all users in a workspace)
    pub async fn get_by_workspace(
        &self,
        workspace_name: String,
    ) -> Result<Vec<WorkspaceLink>, DbErr> {
        let links = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::WorkspaceName.eq(&workspace_name))
            .filter(workspace_link::Column::IsLinked.eq(true))
            .order_by_desc(workspace_link::Column::CreatedAt)
            .all(&self.db)
            .await?;

        Ok(links)
    }

    /// Get paginated users for a workspace with their person details
    pub async fn get_workspace_users_paginated(
        &self,
        workspace_name: String,
        page: u64,
        per_page: u64,
    ) -> Result<(Vec<(WorkspaceLink, Person)>, u64), DbErr> {
        // Get total count
        let total = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::WorkspaceName.eq(&workspace_name))
            .filter(workspace_link::Column::IsLinked.eq(true))
            .count(&self.db)
            .await?;

        // Get paginated links
        let links = WorkspaceLinkEntity::find()
            .filter(workspace_link::Column::WorkspaceName.eq(&workspace_name))
            .filter(workspace_link::Column::IsLinked.eq(true))
            .order_by_desc(workspace_link::Column::CreatedAt)
            .paginate(&self.db, per_page)
            .fetch_page(page)
            .await?;

        // Fetch persons for each link
        let mut results: Vec<(WorkspaceLink, Person)> = Vec::new();
        for link in links {
            if let Ok(Some(person)) = PersonEntity::find_by_id(&link.person_id)
                .one(&self.db)
                .await
            {
                results.push((link, person));
            }
        }

        Ok((results, total))
    }
}
