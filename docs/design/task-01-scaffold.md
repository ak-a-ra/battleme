# Task 01: Project Scaffold

> **For Claude:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Initialize BattleMe as a Tauri v2 + React + TypeScript project with correct folder structure.

**Architecture:** Tauri wraps a React frontend served locally. Rust handles backend logic, SQLite, and Twitch. React handles all UI including overlay and wiki.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite, TailwindCSS, Lucide icons

---

### Step 1: Install prerequisites
```bash
# Ensure Rust is installed
rustup --version

# Ensure Node is installed
node --version

# Install Tauri CLI
cargo install tauri-cli --version "^2.0"
```
Expected: no errors

---

### Step 2: Scaffold Tauri + React project
```bash
npm create tauri-app@latest battleme -- --template react-ts
cd battleme
npm install
```
Expected: project folder created with `src/` and `src-tauri/`

---

### Step 3: Install frontend dependencies
```bash
npm install tailwindcss @tailwindcss/vite
npm install lucide-react
# No shadcn/ui — use raw Tailwind + Lucide to avoid interactive prompts
```

---

### Step 4: Set up folder structure
```
src/
  pages/
    overlay/
    dashboard/
    wiki/
    admin/
    history/
    stats/
  components/
    battle/
    ui/
  hooks/
  lib/
src-tauri/
  src/
    commands/
    db/
    battle/
    twitch/
```
Create each folder with a `.gitkeep` file.

---

### Step 5: Configure Vite for multi-page routing
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 }
})
```

---

### Step 6: Add React Router
```bash
npm install react-router-dom
```
```tsx
// src/main.tsx
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
// stub routes for: /overlay /dashboard /wiki /admin /history /stats
```

---

### Step 7: Create .env template
```bash
# .env.example
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_CHANNEL_NAME=
ANTHROPIC_API_KEY=
```
Add `.env` to `.gitignore`.

---

### Step 8: Init git and commit
```bash
git init
git add .
git commit -m "feat: initial BattleMe scaffold"
```
