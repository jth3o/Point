# Cript

Transcript-to-study-deck pipeline: upload `.vtt` lecture transcripts → extract facts → atomic flashcards → Anki-like spaced repetition.

## Setup

1. **Install dependencies**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Environment**

   Copy `.env.local.example` to `.env.local` and set:

   - `MONGODB_URI` — e.g. `mongodb://localhost:27017/cript`
   - `OPENAI_API_KEY` — required from Phase 3 (fact extraction / card generation)

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Implemented (Phase 1 & 2)

- **Phase 1:** Next.js + Tailwind + shadcn-style UI, MongoDB connection, Mongoose models (User, Course, Lecture, TranscriptSegment, Fact, Card, ReviewState, ReviewLog), env setup.
- **Phase 2:** Course CRUD, lecture upload (VTT only), VTT parser, transcript segmentation, segment storage, dashboard/course/lecture pages, parse-vtt and segment API routes.

## Remaining (Phase 3+)

- **Phase 3:** OpenAI fact extraction, store facts, lecture page showing segments + facts.
- **Phase 4:** OpenAI card generation, store cards, cards review UI.
- **Phase 5:** SRS scheduler, study page, review logs, due queue.
- **Phase 6:** Card edit/approve/suspend, filtering, polish.

## API (Phase 2)

| Method | Route | Description |
|--------|--------|-------------|
| GET | `/api/courses` | List courses |
| POST | `/api/courses` | Create course |
| GET | `/api/courses/:courseId` | Get course |
| GET | `/api/courses/:courseId/lectures` | List lectures |
| POST | `/api/lectures/upload` | Upload VTT (form: file, courseId, title?) |
| GET | `/api/lectures/:id` | Get lecture |
| GET | `/api/lectures/:id/segments` | List transcript segments |
| POST | `/api/lectures/:id/parse-vtt` | Parse VTT (no DB write of segments) |
| POST | `/api/lectures/:id/segment` | Segment and store segments |

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn-style components.
- **Backend:** Next.js route handlers, Mongoose, MongoDB.
- **Later:** OpenAI Responses API (server-side only).
