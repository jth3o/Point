# Testing Point

## Prerequisites

- **MongoDB** running (local or `MONGODB_URI` in `.env.local`)
- **OpenAI API key** in `.env.local` for fact extraction and card generation

```bash
npm install --legacy-peer-deps
```

---

## 1. Quick pipeline test (no API)

Tests VTT parsing and segmentation only (no DB, no OpenAI):

```bash
npx tsx scripts/test-parse.ts
```

Or with your own file:

```bash
npx tsx scripts/test-parse.ts path/to/lecture.vtt
```

You should see parsed cues and segments printed.

---

## 2. Full app test (browser)

1. **Start the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

2. **Dashboard → Create course**  
   Enter a title (e.g. "Test Course") and click **Create course**.

3. **Open the course**  
   Click **Open** on the new course.

4. **Upload a VTT file**  
   - Use **Choose File** and select `scripts/sample-lecture.vtt` (or any `.vtt`).
   - Optional: set a lecture title.
   - Upload. The lecture should appear with status "Idle" or "Uploaded".

5. **Parse VTT**  
   Click **Parse VTT** on that lecture. Status should move to "Parsed".

6. **Segment**  
   Click **Segment**. Status should move to "Segmented".

7. **View lecture**  
   Click **View**. You should see **Transcript segments** with text and timestamps.

8. **Extract facts** (needs OpenAI)  
   If you have an "Extract facts" action on the course or lecture page, run it. Otherwise call the API:

   ```bash
   curl -X POST http://localhost:3000/api/lectures/LECTURE_ID/extract-facts
   ```

   Replace `LECTURE_ID` with the lecture `_id` from the URL when viewing the lecture (e.g. `http://localhost:3000/lectures/674abc...`).

9. **Generate cards** (needs OpenAI)  
   On the lecture page, in **Generated cards**, click **Generate cards**. Cards should appear below.

10. **Check cards**  
    Cards should show front, back, topic, and type. Each card is tied to at least one fact.

---

## 3. API smoke test (optional)

With the app running and a valid `LECTURE_ID`:

```bash
# Get lecture
curl -s http://localhost:3000/api/lectures/LECTURE_ID | jq .

# Get segments
curl -s http://localhost:3000/api/lectures/LECTURE_ID/segments | jq length

# Get cards (after generating)
curl -s http://localhost:3000/api/lectures/LECTURE_ID/cards | jq length
```

---

## Sample VTT

`scripts/sample-lecture.vtt` is a short valid WebVTT file (about 30 seconds of “lecture” content) you can use for upload and pipeline testing. Timestamps use the format `00:00:00.000` (HH:MM:SS.mmm).
