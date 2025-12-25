# Slacker Frontend

React + TypeScript frontend for the Slacker task management system.

## Features

- 📋 Kanban-style task board with three columns: In Progress, Blocked, and Completed
- 🔄 Auto-refresh every 5 seconds to show latest tasks
- 🎨 Clean, modern UI with status-based color coding
- ⚡ Real-time updates when Slack reactions are added

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Visit http://localhost:5173

## Running with Backend

Make sure the Rust backend is running on port 3000:

```bash
# In the project root
cargo watch -c -x 'run -p slacker'
```

The Vite dev server will proxy API requests to `http://localhost:3000/api`.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to be served by the Axum backend.

## How It Works

1. Frontend polls `/api/tasks/board` every 5 seconds
2. Backend returns tasks grouped by status
3. UI updates automatically when new tasks are created via Slack reactions
4. Task cards show message content, creation time, and task ID

## Task Status Mapping

- 👀 `:eyes:` emoji → In Progress
- ⏳ `:hourglass:` / `:loading:` emoji → Blocked  
- ✅ `:white_check_mark:` emoji → Completed
