# Multi-Workspace Slack Bot Setup

## Overview

The SlackBot has been refactored to support **multiple Slack workspaces simultaneously**. Each workspace has its own Socket Mode connection and processes events independently. Users are linked to specific workspaces, and tasks are filtered based on these workspace links.

## Architecture Changes

### 1. Workspace Configuration (`workspaces.yaml`)

Each workspace is defined with its own tokens:

```yaml
rekash:
  app_token: xapp-1-...
  bot_token: xoxb-...

personal:
  app_token: xapp-2-...
  bot_token: xoxb-...
```

### 2. Multi-Bot Manager (`main.rs`)

The application now:
- Loads `workspaces.yaml` on startup
- Spawns a separate `SlackBot` instance for each workspace
- Each bot runs in its own async task with independent Socket Mode connections

```rust
// Each workspace gets its own bot
for (workspace_name, workspace_config) in workspaces_config.workspaces {
    let bot = SlackBot::new(
        workspace_name.clone(),
        workspace_config.app_token,
        workspace_config.bot_token,
        db_conn.clone(),
    );

    tokio::spawn(async move {
        info!("Starting SlackBot for workspace: {}", workspace_name);
        if let Err(e) = bot.start().await {
            error!("SlackBot for workspace {} failed: {}", workspace_name, e);
        }
    });
}
```

### 3. Workspace Links Database

**Table: `workspace_links`**
- `id`: Primary key
- `person_id`: Foreign key to `persons` table
- `workspace_name`: Reference to workspace in YAML config
- `slack_member_id`: User's Slack member ID in that workspace
- `is_linked`: Whether the user is currently linked to this workspace
- `is_active`: Whether this is the user's currently active workspace (only one per user)
- `created_at`, `updated_at`: Timestamps

### 4. Event Processing with Workspace Filtering

When a Slack reaction is added:
1. Bot receives event from its workspace's Socket Mode connection
2. Bot identifies the Slack user who reacted
3. Bot checks if a `Person` with that `slack_member_id` exists
4. Bot verifies the person is linked to this specific workspace
5. If linked, creates/updates task; otherwise, skips

```rust
// Check if person is linked to this workspace
match workspace_links_repo
    .get_by_person_and_workspace(person.id.clone(), self.workspace_name.clone())
    .await
{
    Ok(link) if link.is_linked => {
        // Process task
    }
    _ => {
        // Skip - user not linked to this workspace
        return Ok(());
    }
}
```

### 5. Task Board Filtering

The task board (`/api/tasks/board`) now:
1. Gets the user's **active workspace**
2. Only shows tasks from users linked to that workspace
3. Returns empty board if no active workspace

## Setup Instructions

### 1. Create Workspace Configuration

Create `workspaces.yaml` in the project root:

```yaml
workspace_name:
  app_token: xapp-...
  bot_token: xoxb-...
```

**Get tokens from Slack:**
- **App Token**: Go to your Slack App → Basic Information → App-Level Tokens → Generate token with `connections:write` scope
- **Bot Token**: Go to OAuth & Permissions → Bot User OAuth Token

### 2. Run Database Migrations

```bash
cd migration
cargo run -- up
```

This creates the `workspace_links` table.

### 3. Start the Backend

```bash
cd app
cargo run
```

You should see logs like:
```
Loaded 2 workspaces from config
Starting SlackBot for workspace: rekash
Starting SlackBot for workspace: personal
```

### 4. Link Users to Workspaces

Users must link their account to workspaces via the frontend:

1. User signs in with Google OAuth
2. Navigate to **Projects** page
3. Click **Link Workspace** for each workspace they belong to
4. Backend validates the user's email exists in that Slack workspace
5. Stores the `slack_member_id` for that user-workspace pair

### 5. Switch Active Workspace

Users can switch between linked workspaces:
- Click **Switch To** on the workspace in Projects page
- Task board updates to show tasks from that workspace only

## API Endpoints

### Workspace Management

**GET `/api/workspaces`**
- Lists all configured workspaces from YAML
- Shows linked status for current user

**GET `/api/workspaces/active`**
- Returns the user's currently active workspace

**POST `/api/workspaces/link`**
- Body: `{ "workspace_name": "rekash" }`
- Links user to workspace (validates email in Slack)
- Auto-activates if it's the user's first workspace

**POST `/api/workspaces/unlink`**
- Body: `{ "workspace_name": "rekash" }`
- Removes workspace link

**POST `/api/workspaces/switch`**
- Body: `{ "workspace_name": "personal" }`
- Sets active workspace for user

## Frontend Integration

### Projects Page (`ProjectsPage.tsx`)

- Displays all workspaces with their link status
- Shows which workspace is currently active (highlighted)
- Provides Link/Unlink/Switch buttons
- Shows loading states and error messages

### Task Board (`TaskBoard.tsx`)

- Automatically filters tasks by active workspace
- Displays "Projects" button to navigate to workspace management

## Key Benefits

1. **Multi-Workspace Support**: Users can be members of multiple Slack workspaces
2. **Independent Connections**: Each workspace has its own Socket Mode connection
3. **Workspace Isolation**: Tasks from different workspaces don't mix
4. **Flexible Switching**: Users can switch between workspaces seamlessly
5. **Proper Validation**: User emails are validated against Slack workspace members

## Troubleshooting

### Bot Not Starting for a Workspace

Check logs for errors like:
```
Failed to load workspaces.yaml: ...
```

**Solution**: Ensure `workspaces.yaml` exists and has valid format.

### User Can't Link to Workspace

Error: "Email not found in Slack workspace"

**Solution**: 
- Verify the user's Google email matches their Slack email
- Ensure the bot has `users:read` and `users:read.email` permissions
- Check that the bot is installed in that workspace

### Tasks Not Showing

**Possible causes**:
1. No active workspace selected → Go to Projects and switch to a workspace
2. User not linked to workspace → Link the workspace first
3. Slack bot not processing events → Check bot logs for connection errors

## Next Steps

1. **Add workspace metadata**: Store workspace display names, logos, etc.
2. **Batch operations**: Allow linking to multiple workspaces at once
3. **Workspace admin**: Allow workspace admins to manage members
4. **Task migration**: Tools to move tasks between workspaces

