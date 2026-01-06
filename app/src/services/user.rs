use reqwest::Client;
use serde::Deserialize;

pub async fn fetch_user_by_email_with_config(
    bot_token: &str,
    _client_id: &str,
    email: &str,
) -> anyhow::Result<(String, String)> {
    #[derive(Debug, Deserialize)]
    struct UserProfile {
        real_name: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct User {
        id: String,
        name: String,
        profile: UserProfile,
    }

    #[derive(Debug, Deserialize)]
    struct LookupResponse {
        ok: bool,
        user: Option<User>,
        error: Option<String>,
    }

    let http_client = Client::new();
    let url = "https://slack.com/api/users.lookupByEmail";
    let response = http_client
        .get(url)
        .header("Authorization", format!("Bearer {}", bot_token))
        .query(&[("email", email)])
        .send()
        .await?
        .json::<LookupResponse>()
        .await?;

    if let Some(user) = response.user {
        let name = user.profile.real_name.unwrap_or(user.name);
        Ok((user.id, name))
    } else {
        Err(anyhow::anyhow!(
            "User not found in Slack: {}",
            response
                .error
                .unwrap_or_else(|| "unknown error".to_string())
        ))
    }
}
