# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-06

### Added
- **Multi-workspace support**: Configure multiple Slack workspaces via `workspaces.yaml`
- **Google OAuth authentication**: Sign up and sign in using Google accounts
- **Multi-account sessions**: Support multiple authenticated Google accounts simultaneously
- **Workspace linking**: Link users to workspaces with automatic Slack member ID validation
- **Initial sync**: Automatically sync historical messages with reactions when linking a workspace
- **Task detail modal**: View task details including message content, Slack link, and status change history
- **Setup wizard**: Guided frontend wizard for configuring Slack app tokens
- **Bot status tracking**: Live/offline status indicators for each workspace's Slack bot
- **Workspace settings page**: Configure tokens and custom emoji-to-status mappings per workspace
- **User management**: Paginated user list, invite users by email, remove users from workspaces
- **Token encryption**: AES-256-GCM encryption for `app_token` and `bot_token` in `workspaces.yaml`
- **Docker support**: Multi-stage Dockerfile and GitHub Actions workflow for building images
- **Welcome screen**: Onboarding UI when no workspaces are configured

### Fixed
- **Slack member ID storage**: `persons.external_id` now properly set when linking workspaces
- **Initial sync user lookup**: Tasks created correctly by looking up users via `external_id`
- **Frontend polling optimization**: Reduced unnecessary API calls with visibility-based polling
- **Auth flow robustness**: Users can sign up even without pre-configured workspaces

### Changed
- Refactored `SlackBot` to support multiple workspaces with per-workspace tokens
- Moved token configuration from environment variables to encrypted YAML file
- Task filtering now based on user's active workspace
