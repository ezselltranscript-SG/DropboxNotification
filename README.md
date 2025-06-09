# 📁 Dropbox Real-Time Folder Watcher

A Node.js service that listens to Dropbox webhook notifications and detects when **new files** are added to a **specific folder**. The watcher triggers custom logic (e.g., calling a webhook, updating a database) whenever a new file appears.

---

## 🚀 Features

- Dropbox Webhook integration for real-time-like updates
- Filters changes to a specific folder
- Prevents duplicate processing via Supabase
- Deployable to any Node-friendly host (e.g., Render, Vercel, Fly.io)
- Easily extendable to trigger actions like:
  - n8n webhooks
  - Supabase events
  - Discord or Slack notifications

---

## 🧱 Tech Stack

- Node.js + Express
- Dropbox API
- Supabase (PostgreSQL)
- Axios

---

## ⚙️ Environment Setup

Create a `.env` file in the root:

```env
PORT=3000

DROPBOX_TOKEN=your_dropbox_oauth_token
DROPBOX_FOLDER_PATH=/path-to-watch

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
