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
    config::config::Config,
    models::task::TaskStatus,
    repos::{messages::MessagesRepo, persons::PersonsRepo, tasks::TasksRepo},
    services::slack_service::eval_status_from_reactions,
};

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

fn emoji_to_status(emoji: &str) -> Option<TaskStatus> {
    match emoji {
        "eyes" => Some(TaskStatus::InProgress),
        "arrows_counterclockwise" | "loading" | "hourglass" => Some(TaskStatus::Blocked),
        "white_check_mark" | "heavy_check_mark" => Some(TaskStatus::Completed),
        _ => None,
    }
}

fn map_reactions_to_status(reactions: &Vec<SlackReaction>) -> HashSet<TaskStatus> {
    let mut status_set: HashSet<TaskStatus> = HashSet::new();

    for reaction in reactions {
        match emoji_to_status(&reaction.name) {
            Some(status) => {
                status_set.insert(status);
            }
            None => {
                warn!("Wrong emoji type received: {}", &reaction.name);
            }
        };
    }

    status_set
}

pub struct SlackBot {
    config: Config,
    db: DatabaseConnection,
    http_client: Client,
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
    pub fn new(config: Config, db: DatabaseConnection) -> Self {
        Self {
            config,
            db,
            http_client: Client::new(),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let response = self
            .http_client
            .post("https://slack.com/api/apps.connections.open")
            .header("Authorization", format!("Bearer {}", self.config.app_token))
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

        info!("Connected to Slack Socket Mode!");

        while let Some(msg) = read.next().await {
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
                Ok(Message::Close(_)) => break,
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }

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
                let res = self.handle_reaction_added(event).await;
                if res.is_err() {
                    error!("Failed to handle event: {:?}", res.err());
                }
                info!("Reaction removed - could update task status");
            }
            _ => {}
        }
    }

    async fn handle_reaction_added(&self, event: SlackEvent) -> Result<()> {
        let user = match &event.user {
            Some(u) => u,
            None => return Ok(()),
        };

        if user != &self.config.slack_member_id {
            info!("Ignoring reaction from other user: {}", user);
            return Ok(());
        }

        let reaction = match &event.reaction {
            Some(r) => r,
            None => return Ok(()),
        };

        if emoji_to_status(reaction).is_none() {
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
                self.create_or_update_task(message, &item.channel, &item.ts)
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
            .header("Authorization", format!("Bearer {}", self.config.bot_token))
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
    ) -> Result<()> {
        let persons_repo = PersonsRepo::new(self.db.clone());
        let messages_repo = MessagesRepo::new(self.db.clone());
        let tasks_repo = TasksRepo::new(self.db.clone());

        let person = persons_repo.get_by_external_id(slack_message.user).await?;
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
                        &person,
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
        let status_set = map_reactions_to_status(&reactions);
        let correct_status = eval_status_from_reactions(status_set);
        let status = correct_status;

        match task_message {
            Ok(task) => {
                tasks_repo.change_status(task.id.clone(), status).await?;
            }
            Err(DbErr::RecordNotFound(e)) => {
                error!("Task not found, creating new task: {}", e);
                tasks_repo
                    .create(status, person, chrono::Utc::now().naive_utc(), message)
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
            .header("Authorization", format!("Bearer {}", self.config.bot_token))
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

        for message in all_messages {
            let message_reactions = self
                .fetch_message_reactions(&message.channel, &message.timestamp)
                .await?;
            let status_set = map_reactions_to_status(&message_reactions);
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
