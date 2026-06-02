# Point

**Turn lecture transcripts into flashcards — automatically.**

Point is a full-stack web app that takes `.vtt` lecture transcript files, extracts key facts using AI, generates atomic flashcards, and quizzes you using a spaced repetition scheduler (like Anki, but built in).

🔗 **Live:** [point-tawny.vercel.app](https://point-tawny.vercel.app)

---

## How It Works

1. **Upload** a `.vtt` transcript from any lecture recording
2. **Point parses and segments** the transcript into meaningful chunks
3. **OpenAI extracts facts** from each segment
4. **Flashcards are generated** automatically from those facts
5. **Study** with a spaced repetition scheduler — cards resurface based on how well you know them

---

## Features

- 📁 **Course management** — organize lectures by course
- 📄 **VTT upload & parsing** — automatic transcript segmentation
- 🤖 **AI fact extraction** — OpenAI pulls key facts from each segment
- 🃏 **Flashcard generation** — atomic cards created from extracted facts
- 🔁 **Spaced repetition** — SRS scheduler with Again / Hard / Good / Easy ratings
- 💡 **In-session help** — ask for an explanation or example on any card mid-review
- 🗑️ **Card management** — edit, suspend, or delete cards with reason tracking
- 🔐 **Authentication** — session-based auth, each user sees only their own data

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers, Mongoose, MongoDB |
| AI | OpenAI Responses API |
| Auth | Custom session-based auth |
| Deployment | Vercel |

---

## Local Setup

**1. Install dependencies**
```bash
npm install --legacy-peer-deps
```

**2. Configure environment**

Copy `.env.local.example` to `.env.local` and fill in:
```
MONGODB_URI=mongodb://localhost:27017/point
OPENAI_API_KEY=sk-...
```

**3. Run**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## API Reference

| Method | Route | Description |
|---|---|---|
| GET | `/api/courses` | List all courses |
| POST | `/api/courses` | Create course |
| PATCH | `/api/courses/:courseId` | Update course |
| POST | `/api/lectures/upload` | Upload VTT file |
| GET | `/api/lectures/:id/segments` | Get transcript segments |
| POST | `/api/lectures/:id/segment` | Segment and store transcript |
| GET | `/api/review/due` | Get due cards for review |
| POST | `/api/review/rate` | Submit rating for a card |
