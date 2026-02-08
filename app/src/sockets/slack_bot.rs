use std::{collections::HashSet, time::Duration};

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use sea_orm::{sqlx::types::chrono, DatabaseConnection, DbErr};
use serde::{Deserialize, Serialize};
use tokio::time::interval;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::{
    config::{config::Config, workspaces::WorkspacesConfig},
    core::bot_status::BotStatusManager,
    models::{task::TaskStatus, workspace_settings::EmojiMappings},
    repos::{
        messages::MessagesRepo, persons::PersonsRepo, tasks::TasksRepo,
        workspace_links::WorkspaceLinksRepo, workspace_settings::WorkspaceSettingsRepo,
    },
    services::slack_service::eval_status_from_reactions,
};

// NOTE: This SlackBot currently uses Config which no longer has bot_token/app_token.
// TODO: Refactor to use WorkspacesConfig and create one bot instance per workspace.
// Each workspace should have its own WebSocket connection.

#[derive(Debug, Deserialize)]
struct ConnectionResponse {
    ok: bool,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackEventItem {
    #[serde(rename = "type")]
    item_type: String,
    channel: String,
    ts: String,
}

#[derive(Debug, Deserialize)]
struct SlackReaction {
    name: String,
    #[serde(default)]
    users: Vec<String>,
    #[serde(default)]
    count: i32,
}

#[derive(Debug, Deserialize)]
struct SlackEvent {
    #[serde(rename = "type")]
    event_type: String,
    user: Option<String>,
    reaction: Option<String>,
    item: Option<SlackEventItem>,
}

#[derive(Debug, Deserialize)]
struct EventPayload {
    event: Option<SlackEvent>,
}

#[derive(Debug, Deserialize)]
struct SlackEnvelope {
    #[serde(rename = "type")]
    envelope_type: String,
    envelope_id: Option<String>,
    payload: Option<EventPayload>,
}

#[derive(Debug, Deserialize)]
struct SlackMessage {
    text: String,
    user: String,
    ts: String,
    thread_timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    ok: bool,
    messages: Option<Vec<SlackMessage>>,
}

#[derive(Debug, Serialize)]
struct Acknowledgment {
    envelope_id: String,
}

fn emoji_to_status(emoji: &str, mappings: &EmojiMappings) -> Option<TaskStatus> {
    if mappings.in_progress.contains(&emoji.to_string()) {
        return Some(TaskStatus::InProgress);
    }
    if mappings.blocked.contains(&emoji.to_string()) {
        return Some(TaskStatus::Blocked);
    }
    if mappings.completed.contains(&emoji.to_string()) {
        return Some(TaskStatus::Completed);
    }
    None
}

fn map_reactions_to_status(
    reactions: &Vec<SlackReaction>,
    mappings: &EmojiMappings,
) -> HashSet<TaskStatus> {
    let mut status_set: HashSet<TaskStatus> = HashSet::new();

    for reaction in reactions {
        match emoji_to_status(&reaction.name, mappings) {
            Some(status) => {
                status_set.insert(status);
            }
            None => {
                // Silently ignore non-mapped emojis (common case)
            }
        };
    }

    status_set
}

pub struct SlackBot {
    workspace_name: String,
    app_token: String,
    bot_token: String,
    db: DatabaseConnection,
    http_client: Client,
    status_manager: BotStatusManager,
}

#[derive(Debug, Deserialize)]
struct MessageWithReactions {
    #[serde(rename = "type", default)]
    msg_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    reactions: Option<Vec<SlackReaction>>,
    #[serde(flatten, default)]
    _extra: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ReactionsResponse {
    ok: bool,
    #[serde(default)]
    message: Option<MessageWithReactions>,
}

impl SlackBot {
    pub fn new(
        workspace_name: String,
        app_token: String,
        bot_token: String,
        db: DatabaseConnection,
        status_manager: BotStatusManager,
    ) -> Self {
        Self {
            workspace_name,
            app_token,
            bot_token,
            db,
            http_client: Client::new(),
            status_manager,
        }
    }

    pub async fn start(&self) -> Result<()> {
        let response = self
            .http_client
            .post("https://slack.com/api/apps.connections.open")
            .header("Authorization", format!("Bearer {}", self.app_token))
            .send()
            .await?
            .json::<ConnectionResponse>()
            .await?;

        let ws_url = response
            .url
            .ok_or(anyhow::anyhow!("Failed to get WebSocket URL"))?;
        info!("Connecting to Slack: {}", ws_url);

        let (ws_stream, _) = connect_async(&ws_url).await?;
        let (mut write, mut read) = ws_stream.split();

        info!(
            "Connected to Slack Socket Mode for workspace: {}",
            self.workspace_name
        );

        // Mark as connected
        self.status_manager
            .set_connected(&self.workspace_name)
            .await;

        // Spawn initial sync in background so it doesn't block the event loop
        let workspace_name_clone = self.workspace_name.clone();
        let bot_token_clone = self.bot_token.clone();
        let db_clone = self.db.clone();
        let status_manager_clone = self.status_manager.clone();

        tokio::spawn(async move {
            let syncer = InitialSyncer {
                workspace_name: workspace_name_clone,
                bot_token: bot_token_clone,
                db: db_clone,
                http_client: Client::new(),
                status_manager: status_manager_clone,
            };
            syncer.perform_initial_sync_for_all_users().await;
        });

        while let Some(msg) = read.next().await {
            // Update heartbeat on any message
            self.status_manager.heartbeat(&self.workspace_name).await;

            match msg {
                Ok(Message::Text(text)) => {
                    info!("Received text message: {}", text);

                    match serde_json::from_str::<SlackEnvelope>(&text) {
                        Ok(envelope) => {
                            if let Some(envelope_id) = &envelope.envelope_id {
                                let ack = serde_json::to_string(&Acknowledgment {
                                    envelope_id: envelope_id.clone(),
                                })?;

                                write.send(Message::Text(ack.into())).await?;
                            }

                            if envelope.envelope_type == "events_api" {
                                if let Some(payload) = envelope.payload {
                                    if let Some(event) = payload.event {
                                        self.handle_event(event).await;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse SlackEnvelope: {}", e);
                            error!("Raw text was: {}", text);
                        }
                    }
                }
                Ok(Message::Ping(data)) => {
                    write.send(Message::Pong(data)).await?;
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket closed for workspace: {}", self.workspace_name);
                    self.status_manager
                        .set_disconnected(
                            &self.workspace_name,
                            Some("Connection closed".to_string()),
                        )
                        .await;
                    break;
                }
                Err(e) => {
                    error!("WebSocket error for {}: {}", self.workspace_name, e);
                    self.status_manager
                        .set_disconnected(&self.workspace_name, Some(e.to_string()))
                        .await;
                    break;
                }
                _ => {}
            }
        }

        // Mark as disconnected when loop exits
        self.status_manager
            .set_disconnected(&self.workspace_name, None)
            .await;

        Ok(())
    }

    async fn handle_event(&self, event: SlackEvent) {
        match event.event_type.as_str() {
            "reaction_added" => {
                let res = self.handle_reaction_added(event).await;
                if res.is_err() {
                    error!("Failed to handle event: {:?}", res.err());
                }
            }
            "reaction_removed" => {
                let res = self.handle_reaction_removed(event).await;
                if res.is_err() {
                    error!("Failed to handle event: {:?}", res.err());
                }
            }
            _ => {}
        }
    }

    async fn get_emoji_mappings(&self) -> EmojiMappings {
        let settings_repo = WorkspaceSettingsRepo::new(self.db.clone());
        settings_repo
            .get_emoji_mappings(&self.workspace_name)
            .await
            .unwrap_or_else(|_| EmojiMappings::default_mappings())
    }

    async fn handle_reaction_added(&self, event: SlackEvent) -> Result<()> {
        let reactor_slack_id = match &event.user {
            Some(u) => u.clone(),
            None => return Ok(()),
        };

        let reaction = match &event.reaction {
            Some(r) => r,
            None => return Ok(()),
        };

        // Get emoji mappings for this workspace
        let emoji_mappings = self.get_emoji_mappings().await;

        if emoji_to_status(reaction, &emoji_mappings).is_none() {
            info!("Ignoring non-task emoji: {}", reaction);
            return Ok(());
        }

        let item = match &event.item {
            Some(i) => i,
            None => return Ok(()),
        };

        info!(
            "Task emjoi '{}' added to message {} in channel {}",
            reaction, item.ts, item.channel
        );

        match self.fetch_message(&item.channel, &item.ts).await {
            Ok(message) => {
                self.create_or_update_task(
                    message,
                    &item.channel,
                    &item.ts,
                    Some(&reactor_slack_id),
                )
                .await?;
            }
            Err(e) => error!("Failed to fetch message: {}", e),
        }

        Ok(())
    }

    async fn handle_reaction_removed(&self, event: SlackEvent) -> Result<()> {
        let reaction = match &event.reaction {
            Some(r) => r,
            None => return Ok(()),
        };

        let emoji_mappings = self.get_emoji_mappings().await;
        if emoji_to_status(reaction, &emoji_mappings).is_none() {
            return Ok(());
        }

        let item = match &event.item {
            Some(i) => i,
            None => return Ok(()),
        };

        match self.fetch_message(&item.channel, &item.ts).await {
            Ok(message) => {
                // Recompute status after removal, but don't reassign ownership on a remove event.
                self.create_or_update_task(message, &item.channel, &item.ts, None)
                    .await?;
            }
            Err(e) => error!("Failed to fetch message: {}", e),
        }

        Ok(())
    }

    async fn fetch_message(&self, channel: &str, timestamp: &str) -> Result<SlackMessage> {
        let response = self
            .http_client
            .get("https://slack.com/api/conversations.history")
            .header("Authorization", format!("Bearer {}", self.bot_token))
            .query(&[
                ("channel", channel),
                ("latest", timestamp),
                ("inclusive", "true"),
                ("limit", "1"),
            ])
            .send()
            .await?;

        let status = response.status();
        let response_text = response.text().await?;

        info!("Slack API Response (status {}): {}", status, response_text);

        let response_json: MessageResponse = serde_json::from_str(&response_text).map_err(|e| {
            error!("Failed to parse Slack response: {}", e);
            error!("Raw response text: {}", response_text);
            anyhow::anyhow!("Failed to parse Slack response: {}", e)
        })?;

        response_json
            .messages
            .and_then(|mut m| m.pop())
            .ok_or_else(|| anyhow::anyhow!("Message not found"))
    }

    async fn create_or_update_task(
        &self,
        slack_message: SlackMessage,
        channel: &str,
        message_timestamp: &str,
        reactor_slack_id: Option<&str>,
    ) -> Result<()> {
        let persons_repo = PersonsRepo::new(self.db.clone());
        let messages_repo = MessagesRepo::new(self.db.clone());
        let tasks_repo = TasksRepo::new(self.db.clone());
        let workspace_links_repo = WorkspaceLinksRepo::new(self.db.clone());

        // Get assignee (person who wrote the message)
        let assignee = match persons_repo
            .get_by_external_id(slack_message.user.clone())
            .await
        {
            Ok(p) => p,
            Err(_) => {
                info!(
                    "No person found for Slack member {} - skipping task creation",
                    slack_message.user
                );
                return Ok(());
            }
        };

        // Get assigner (person who added the reaction) - optional
        let assigner = match reactor_slack_id {
            Some(reactor_id) => persons_repo
                .get_by_external_id(reactor_id.to_string())
                .await
                .ok(),
            None => None,
        };

        // Check if assignee is linked to this workspace
        match workspace_links_repo
            .get_by_person_and_workspace(assignee.id.clone(), self.workspace_name.clone())
            .await
        {
            Ok(link) if link.is_linked => {
                info!(
                    "User {} is linked to workspace {} - processing task",
                    assignee.email, self.workspace_name
                );
            }
            Ok(_) => {
                info!(
                    "User {} is not linked to workspace {} - skipping task creation",
                    assignee.email, self.workspace_name
                );
                return Ok(());
            }
            Err(_) => {
                info!(
                    "User {} has no link to workspace {} - skipping task creation",
                    assignee.email, self.workspace_name
                );
                return Ok(());
            }
        }

        let message_external_id = format!("slack:{}:{}", channel, message_timestamp);
        let message = messages_repo
            .get_message_by_external_id(message_external_id.clone())
            .await;

        let message: Option<_> = match message {
            Ok(msg) => {
                info!("Message already exists, skipping to create it.");
                Some(msg)
            }
            Err(DbErr::RecordNotFound(_)) => {
                // create the message if it's not there
                let created = messages_repo
                    .create(
                        slack_message.text,
                        message_external_id.clone(),
                        channel.to_string(),
                        message_timestamp.to_string(),
                        &assignee,
                    )
                    .await?;
                Some(created)
            }
            _ => {
                error!("Failed to process slack message {}", message_external_id);
                None
            }
        };

        if message.is_none() {
            return Ok(());
        }
        let message = message.unwrap();
        let task_message = tasks_repo.get_task_by_message_id(message.id.clone()).await;

        let reactions = self
            .fetch_message_reactions(channel, message_timestamp)
            .await?;

        // Get emoji mappings for this workspace
        let emoji_mappings = self.get_emoji_mappings().await;
        let status_set = map_reactions_to_status(&reactions, &emoji_mappings);
        let correct_status = eval_status_from_reactions(status_set);
        let status = correct_status;

        match task_message {
            Ok(task) => {
                tasks_repo.change_status(task.id.clone(), status).await?;

                // Track the latest known reactor as owner for the "My Tasks" view.
                if let Some(assigner_id) = assigner.as_ref().map(|p| p.id.clone()) {
                    if task.assigned_by.as_ref() != Some(&assigner_id) {
                        tasks_repo
                            .change_assigned_by(task.id.clone(), Some(assigner_id))
                            .await?;
                    }
                }
            }
            Err(DbErr::RecordNotFound(e)) => {
                info!("Task not found, creating new task: {}", e);
                if status == TaskStatus::Blank {
                    // Don't create empty tasks when tracked reactions were removed.
                    return Ok(());
                }
                tasks_repo
                    .create(
                        status,
                        assignee,
                        assigner,
                        chrono::Utc::now().naive_utc(),
                        message,
                    )
                    .await?;
            }
            Err(e) => {
                error!("Failed to process task: {}", e);
                return Ok(());
            }
        }

        Ok(())
    }

    async fn fetch_message_reactions(
        &self,
        channel: &str,
        timestamp: &str,
    ) -> Result<Vec<SlackReaction>> {
        let response = self
            .http_client
            .get("https://slack.com/api/reactions.get")
            .header("Authorization", format!("Bearer {}", self.bot_token))
            .query(&[("channel", channel), ("timestamp", timestamp)])
            .send()
            .await?
            .json::<ReactionsResponse>()
            .await?;

        Ok(response
            .message
            .and_then(|m| m.reactions)
            .unwrap_or_default())
    }

    pub async fn run_periodic_sync(&self) -> Result<()> {
        let messages_repo = MessagesRepo::new(self.db.clone());
        let tasks_repo = TasksRepo::new(self.db.clone());
        let all_messages = messages_repo.get_all().await?;

        // Get emoji mappings for this workspace
        let emoji_mappings = self.get_emoji_mappings().await;

        for message in all_messages {
            let message_reactions = self
                .fetch_message_reactions(&message.channel, &message.timestamp)
                .await?;
            let status_set = map_reactions_to_status(&message_reactions, &emoji_mappings);
            let correct_status = eval_status_from_reactions(status_set);

            let mapped_task = tasks_repo.get_task_by_message_id(message.id).await?;

            tasks_repo
                .change_status(mapped_task.id.clone(), correct_status)
                .await?;
        }

        info!("Finished periodically updating tasks");
        Ok(())
    }

    pub async fn start_periodic_tasks_sync(&self) {
        let mut interval = interval(Duration::from_secs(300));

        loop {
            interval.tick().await;

            if let Err(e) = self.run_periodic_sync().await {
                error!("Periodic task failed: {}", e);
            }
        }
    }
}

// Additional structs for channel listing and history
#[derive(Debug, Deserialize)]
struct SlackChannel {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct ChannelsResponse {
    ok: bool,
    channels: Option<Vec<SlackChannel>>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HistoryMessage {
    #[serde(default)]
    user: Option<String>,
    #[serde(default)]
    text: Option<String>,
    ts: String,
    #[serde(default)]
    reactions: Option<Vec<HistoryReaction>>,
}

#[derive(Debug, Deserialize)]
struct HistoryReaction {
    name: String,
    #[serde(default)]
    users: Option<Vec<String>>,
    #[serde(default)]
    count: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct HistoryResponse {
    ok: bool,
    messages: Option<Vec<HistoryMessage>>,
    response_metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Deserialize)]
struct ResponseMetadata {
    next_cursor: Option<String>,
}

/// Separate struct for initial sync to run in background without blocking SlackBot
pub struct InitialSyncer {
    pub workspace_name: String,
    pub bot_token: String,
    pub db: DatabaseConnection,
    pub http_client: Client,
    pub status_manager: BotStatusManager,
}

impl InitialSyncer {
    pub fn new(
        workspace_name: String,
        bot_token: String,
        db: DatabaseConnection,
        status_manager: BotStatusManager,
    ) -> Self {
        Self {
            workspace_name,
            bot_token,
            db,
            http_client: Client::new(),
            status_manager,
        }
    }
}

impl InitialSyncer {
    pub async fn perform_initial_sync_for_all_users(&self) {
        info!(
            "Starting initial sync for all users in workspace: {}",
            self.workspace_name
        );

        let workspace_links_repo = WorkspaceLinksRepo::new(self.db.clone());

        // Get all linked users for this workspace
        match workspace_links_repo
            .get_by_workspace(self.workspace_name.clone())
            .await
        {
            Ok(links) => {
                info!(
                    "Found {} linked users for workspace {}",
                    links.len(),
                    self.workspace_name
                );

                if links.is_empty() {
                    info!(
                        "No linked users to sync for workspace {}",
                        self.workspace_name
                    );
                    self.status_manager
                        .set_sync_complete(&self.workspace_name)
                        .await;
                    return;
                }

                for link in links {
                    if let Some(slack_member_id) = &link.slack_member_id {
                        info!(
                            "Syncing messages for user with Slack ID: {}",
                            slack_member_id
                        );
                        if let Err(e) = self.perform_initial_sync(slack_member_id).await {
                            error!("Failed to sync for user {}: {}", slack_member_id, e);
                            // Clear syncing status on error
                            self.status_manager
                                .set_sync_complete(&self.workspace_name)
                                .await;
                        }
                    }
                }
            }
            Err(e) => {
                error!(
                    "Failed to get workspace links for {}: {}",
                    self.workspace_name, e
                );
                // Clear syncing status on error
                self.status_manager
                    .set_sync_complete(&self.workspace_name)
                    .await;
            }
        }

        info!(
            "Initial sync completed for workspace: {}",
            self.workspace_name
        );
    }

    async fn get_emoji_mappings(&self) -> EmojiMappings {
        let settings_repo = WorkspaceSettingsRepo::new(self.db.clone());
        settings_repo
            .get_emoji_mappings(&self.workspace_name)
            .await
            .unwrap_or_else(|_| EmojiMappings::default_mappings())
    }

    pub async fn perform_initial_sync(&self, user_slack_id: &str) -> Result<()> {
        info!(
            "Starting initial sync for user {} in workspace {}",
            user_slack_id, self.workspace_name
        );

        self.status_manager
            .set_syncing(
                &self.workspace_name,
                Some("Fetching channels...".to_string()),
            )
            .await;

        // Fetch all channels the bot has access to
        let channels = match self.fetch_channels().await {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to fetch channels: {}. Make sure your Slack app has the 'channels:read' and 'groups:read' scopes.", e);
                self.status_manager
                    .set_sync_complete(&self.workspace_name)
                    .await;
                return Err(e);
            }
        };
        info!("Found {} channels to sync", channels.len());

        let emoji_mappings = self.get_emoji_mappings().await;
        let mut processed_messages = 0;
        let mut created_tasks = 0;

        for (idx, channel) in channels.iter().enumerate() {
            let progress = format!(
                "Scanning channel {}/{}: {}",
                idx + 1,
                channels.len(),
                channel.name
            );
            self.status_manager
                .set_syncing(&self.workspace_name, Some(progress))
                .await;

            // Fetch messages with reactions from this channel
            match self
                .fetch_channel_messages_with_reactions(&channel.id, user_slack_id)
                .await
            {
                Ok(messages) => {
                    for msg in messages {
                        processed_messages += 1;

                        // Check if message has tracked reactions
                        if let Some(reactions) = &msg.reactions {
                            let slack_reactions: Vec<SlackReaction> = reactions
                                .iter()
                                .map(|hr| SlackReaction {
                                    name: hr.name.clone(),
                                    users: hr.users.clone().unwrap_or_default(),
                                    count: hr.count.unwrap_or(0),
                                })
                                .collect();

                            let status_set =
                                map_reactions_to_status(&slack_reactions, &emoji_mappings);
                            if !status_set.is_empty() {
                                if let Err(e) = self
                                    .create_task_from_history(&msg, &channel.id, &emoji_mappings)
                                    .await
                                {
                                    warn!("Failed to create task from history: {}", e);
                                } else {
                                    created_tasks += 1;
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch messages from channel {}: {}",
                        channel.name, e
                    );
                }
            }
        }

        info!(
            "Initial sync complete for workspace {}. Processed {} messages, created {} tasks",
            self.workspace_name, processed_messages, created_tasks
        );

        self.status_manager
            .set_sync_complete(&self.workspace_name)
            .await;

        Ok(())
    }

    async fn fetch_channels(&self) -> Result<Vec<SlackChannel>> {
        let response = self
            .http_client
            .get("https://slack.com/api/conversations.list")
            .header("Authorization", format!("Bearer {}", self.bot_token))
            .query(&[
                ("types", "public_channel,private_channel"),
                ("exclude_archived", "true"),
                ("limit", "1000"),
            ])
            .send()
            .await?
            .json::<ChannelsResponse>()
            .await?;

        if !response.ok {
            return Err(anyhow::anyhow!(
                "Failed to fetch channels: {:?}",
                response.error
            ));
        }

        Ok(response.channels.unwrap_or_default())
    }

    async fn fetch_channel_messages_with_reactions(
        &self,
        channel_id: &str,
        user_slack_id: &str,
    ) -> Result<Vec<HistoryMessage>> {
        let mut all_messages = Vec::new();
        let mut cursor: Option<String> = None;
        let mut pages = 0;
        const MAX_PAGES: i32 = 5;

        loop {
            let mut query = vec![
                ("channel", channel_id.to_string()),
                ("limit", "100".to_string()),
            ];

            if let Some(ref c) = cursor {
                query.push(("cursor", c.clone()));
            }

            let response = self
                .http_client
                .get("https://slack.com/api/conversations.history")
                .header("Authorization", format!("Bearer {}", self.bot_token))
                .query(&query)
                .send()
                .await?
                .json::<HistoryResponse>()
                .await?;

            if !response.ok {
                break;
            }

            if let Some(messages) = response.messages {
                let user_messages: Vec<HistoryMessage> = messages
                    .into_iter()
                    .filter(|m| {
                        m.user.as_ref() == Some(&user_slack_id.to_string()) && m.reactions.is_some()
                    })
                    .collect();

                all_messages.extend(user_messages);
            }

            pages += 1;
            if pages >= MAX_PAGES {
                break;
            }

            if let Some(metadata) = response.response_metadata {
                if let Some(next_cursor) = metadata.next_cursor {
                    if next_cursor.is_empty() {
                        break;
                    }
                    cursor = Some(next_cursor);
                } else {
                    break;
                }
            } else {
                break;
            }

            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        Ok(all_messages)
    }

    async fn create_task_from_history(
        &self,
        msg: &HistoryMessage,
        channel_id: &str,
        emoji_mappings: &EmojiMappings,
    ) -> Result<()> {
        let persons_repo = PersonsRepo::new(self.db.clone());
        let messages_repo = MessagesRepo::new(self.db.clone());
        let tasks_repo = TasksRepo::new(self.db.clone());
        let workspace_links_repo = WorkspaceLinksRepo::new(self.db.clone());

        let user_id = msg
            .user
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No user on message"))?;
        let text = msg.text.as_ref().cloned().unwrap_or_default();
        let ts = &msg.ts;

        // Look up person by external_id (Slack member ID)
        let person = persons_repo
            .get_by_external_id(user_id.clone())
            .await
            .map_err(|_| anyhow::anyhow!("No person found for Slack member {}", user_id))?;

        // Verify person is linked to this workspace
        match workspace_links_repo
            .get_by_person_and_workspace(person.id.clone(), self.workspace_name.clone())
            .await
        {
            Ok(link) if link.is_linked => {}
            _ => {
                return Err(anyhow::anyhow!(
                    "Person {} not linked to workspace {}",
                    person.email,
                    self.workspace_name
                ))
            }
        }

        let message_external_id = format!("slack:{}:{}", channel_id, ts);

        if messages_repo
            .get_message_by_external_id(message_external_id.clone())
            .await
            .is_ok()
        {
            return Ok(());
        }

        let message = messages_repo
            .create(
                text,
                message_external_id,
                channel_id.to_string(),
                ts.clone(),
                &person,
            )
            .await?;

        let reactions: Vec<SlackReaction> = msg
            .reactions
            .as_ref()
            .map(|r| {
                r.iter()
                    .map(|hr| SlackReaction {
                        name: hr.name.clone(),
                        users: hr.users.clone().unwrap_or_default(),
                        count: hr.count.unwrap_or(0),
                    })
                    .collect()
            })
            .unwrap_or_default();

        let status_set = map_reactions_to_status(&reactions, emoji_mappings);
        let status = eval_status_from_reactions(status_set);

        // Try to get the first reactor as the assigner (if available)
        let assigner = match reactions.iter().filter_map(|r| r.users.first()).next() {
            Some(slack_id) => persons_repo.get_by_external_id(slack_id.clone()).await.ok(),
            None => None,
        };

        tasks_repo
            .create(
                status,
                person,
                assigner,
                chrono::Utc::now().naive_utc(),
                message,
            )
            .await?;

        Ok(())
    }
}
