# RoTools

A polished dark Roblox developer toolkit built with React, Vite, Tailwind CSS, Three.js, JSZip, PapaParse, Lucide icons, Node.js, and Express.

The repository also contains a working external-frame Roblox Shorts proof of concept. See [SHORTS_FEED.md](./SHORTS_FEED.md) for architecture, Studio setup, measured results, limitations, and commands.

## Features

- Landing page, dashboard, docs, pricing placeholder, and settings
- Bulk Developer Products tool with validation, dry run mode, backend-only Roblox Open Cloud calls, retry flow, JSON mapping export, and Lua ModuleScript export
- 3D Icon / Outline Generator for `.glb`, `.gltf`, `.obj`, and `.fbx` files with transparent PNG and ZIP export
- Local persistence through `localStorage`
- Express API with `.env` support

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Link import (TikTok/YouTube Shorts download) requires `yt-dlp.exe` at `tools/yt-dlp.exe`. It is not committed to the repo (18 MB third-party binary) — download the latest release from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and place it there.

The Vite frontend runs on `http://localhost:5173`.
The Express backend runs on `http://localhost:5174`.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```

`npm run dev` starts the backend and frontend together.
`npm run build` writes the production frontend to `dist/`.
`npm start` serves the API and the built frontend.

## Environment Variables

Create `.env` in the project root:

```bash
PORT=5174
CLIENT_ORIGIN=http://localhost:5173
ROBLOX_API_KEY=
```

Security warning: never expose `ROBLOX_API_KEY` in frontend code. The frontend sends product table data to the Express backend, and the backend calls Roblox Open Cloud.

## Roblox Open Cloud Notes

1. Open Roblox Creator Dashboard.
2. Create an Open Cloud API key.
3. Grant the key access to the target experience or universe.
4. Enable the required permissions for Developer Products.
5. Put the key in `.env` as `ROBLOX_API_KEY`.
6. Find your Universe ID in the experience details page or Creator Dashboard URL.

Roblox Open Cloud endpoints can evolve. API integration is isolated in `server/services/robloxDevProducts.js` so endpoint paths and payloads can be adjusted without touching the UI.

## Deploy Frontend

Run:

```bash
npm run build
```

Deploy the generated `dist/` folder to a static host such as Vercel, Netlify, Cloudflare Pages, or any static web server. Configure the frontend to reach your deployed backend for `/api` routes.

## Deploy Backend

Deploy the project to a Node-capable host such as Render, Railway, Fly.io, or a VPS.

Set environment variables on the host:

```bash
PORT=5174
CLIENT_ORIGIN=https://your-frontend-domain.example
ROBLOX_API_KEY=your-secret-key
```

Run:

```bash
npm install
npm run build
npm start
```

## Lua ModuleScript Export

The Bulk Developer Products page can export a ModuleScript shaped like:

```lua
return {
  ["100_coins"] = {
    productId = 123456789,
    rewardType = "Coins",
    rewardItem = "Coins",
    amount = 100,
  },
}
```

Use the exported table from server-side Roblox scripts to map purchases to rewards.

## Generated Icons

Upload models in the 3D Icon Generator, adjust camera and lighting, then export transparent PNG files. Upload those PNG files to Roblox and assign the resulting image asset IDs to your item UI.
