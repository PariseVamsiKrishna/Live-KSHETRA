# 🎥 Live Kshetra

**Secure, Real-Time Video Collaboration** — A serverless video conferencing platform powered by Supabase Realtime, WebRTC, and React.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/PariseVamsiKrishna/Live-KSHETRA&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY)

---

## ✨ Features

- 🔐 **Zero-Trust Security** — Row Level Security on all tables and `realtime.messages`
- 📡 **Supabase Realtime** — Private channels for WebRTC signaling (no exposed server)
- 🎥 **Adaptive Video Grid** — 1–16+ participants with spotlight mode
- 💬 **In-Call Chat** — Real-time with timestamps and URL detection
- 🖐️ **Hand Raise** — Priority queue with audio chime
- 😂 **Emoji Reactions** — 8 types, float-up animation across all clients
- 📺 **Screen Sharing** — Presenter spotlight with track replacement
- 🖊️ **Collaborative Whiteboard** — Synced canvas with colors, brush sizes, undo
- 📝 **Live Captions** — Web Speech API transcription
- 🎙️ **Meeting Recording** — Client-side WebM export
- 👥 **Host Controls** — Mute-all, kick, lock room
- ☁️ **Fully Serverless** — No backend to manage or pay for

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS (Live Kshetra saffron/dark theme) |
| Realtime Signaling | Supabase Realtime (private channels) |
| Database + Auth | Supabase (PostgreSQL + Anonymous Auth) |
| Security | Row Level Security on all tables |
| Video/Audio | Native WebRTC (`RTCPeerConnection`) |
| Deployment | Vercel (static) + Supabase (backend) |
| CI/CD | GitHub Actions |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/PariseVamsiKrishna/Live-KSHETRA.git
cd Live-KSHETRA
cd client && npm install
```

### 2. Configure Supabase

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Migration

Go to **Supabase Dashboard → SQL Editor** and paste the contents of:
```
supabase/migrations/001_live_kshetra_init.sql
```

### 4. Enable Anonymous Auth

**Supabase Dashboard → Authentication → Providers → Anonymous Sign-In → Enable**

### 5. Run Locally

```bash
cd client && npm run dev
# Open http://localhost:5173
```

---

## ☁️ Deploy to Vercel

### One-Click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/PariseVamsiKrishna/Live-KSHETRA&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY)

### Manual

```bash
npm i -g vercel
vercel link        # Follow prompts — saves .vercel/project.json
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

### GitHub CI/CD Secrets

Add these in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | `https://zkfslsziahchshplgibt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your anon key |
| `VERCEL_TOKEN` | From `vercel.com/account/tokens` |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

---

## 🔐 Security Architecture

```
User (Anonymous JWT)
    │
    ▼
Supabase Auth ──► auth.uid()
    │
    ├── public.rooms          (RLS: only creator + participants)
    ├── public.room_participants  (RLS: only self + co-participants)
    │
    └── Realtime Channel: room:{code}  ◄── Private (JWT required)
            │   realtime.messages RLS:
            │     SELECT/INSERT only if room_code participant
            │
            ▼
        WebRTC offer / answer / ICE (broadcast events)
        Presence (participant state)
        Chat / Reactions / Whiteboard (broadcast events)
```

---

## 📁 Project Structure

```
Live-KSHETRA/
├── supabase/
│   ├── migrations/001_live_kshetra_init.sql
│   └── seed.sql
├── client/
│   ├── src/
│   │   ├── services/
│   │   │   ├── supabase.js     # Client singleton
│   │   │   ├── auth.js         # Anonymous auth helper
│   │   │   ├── webrtc.js       # RTCPeerConnection manager (Supabase channel)
│   │   │   ├── audio.js        # Sound effects + visualizer
│   │   │   ├── speech.js       # Live captions
│   │   │   └── recorder.js     # Meeting recording
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── MeetingContext.jsx
│   │   └── components/
│   │       ├── Landing/
│   │       ├── Lobby/
│   │       └── Meeting/
│   └── ...
├── .github/workflows/ci.yml
├── vercel.json
└── README.md
```

---

## 📄 License

MIT © 2026 PariseVamsiKrishna
