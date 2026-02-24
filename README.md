# House Fix Manager

An Obsidian plugin for managing home renovation and repair tasks. Track work room by room, schedule people, run AI-powered analysis, and generate reports — all inside your vault.

## Features

- **Dashboard** — view all tasks organised by room, with collapsible sections and sticky room headers
- **Rooms** — manage rooms with icons, outdoor flags, and click-to-navigate room cards
- **People** — track team members and their daily capacity
- **Schedules** — assign tasks to people on specific dates
- **Upload** — import tasks from a plain-text or PDF file, or paste a task list directly
- **Reports** — visual charts (donut, bar, stacked), KPI cards, materials summary, and export to PDF or Markdown note
- **AI analysis** — use GitHub Models to enrich tasks with effort estimates, materials lists, and scheduling hints

## Requirements

- Obsidian 1.4.0 or later
- Desktop only (uses Electron/Node APIs for SQLite storage)
- An active internet connection and a **GitHub personal access token** for AI features (see below)

## Installation

### From the Obsidian community plugin list

1. Open **Settings → Community plugins → Browse**
2. Search for **House Fix Manager**
3. Click **Install**, then **Enable**

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/iamrbtm/house-fix-manager/releases/latest)
2. Copy them into `<your vault>/.obsidian/plugins/house-fix-manager/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

## AI features and network use

AI analysis uses the **GitHub Models** inference API (`https://models.inference.ai.azure.com`). This is a paid Microsoft/GitHub service — standard GitHub Models free-tier limits apply.

To enable AI features:

1. Generate a GitHub personal access token at <https://github.com/settings/tokens> (no special scopes required for GitHub Models)
2. Open **Settings → House Fix Manager** and paste the token into the **GitHub API token** field

No data leaves your vault except what you explicitly submit to the AI analysis endpoint. The plugin does not collect telemetry or analytics of any kind.

## Data storage

All task, room, people, and schedule data is stored locally in a SQLite database (`house-fix.db`) inside the plugin folder. Nothing is synced to any external service automatically.

## License

[MIT](LICENSE) — Jeremy Guill
