# Siddhartha — Project Status

> Snapshot of where the codebase actually is vs. where `CLAUDE.md` says it should be.
> Audited: 2026-06-16. Re-audit before making big planning decisions.

## TL;DR
Library + reader (PDF + EPUB) + highlight capture work end-to-end against Supabase.
The **memory engine — embeddings, themes, connections, surfacing — is unbuilt**. That is
the core product differentiator and the next major scope. The build order in
`CLAUDE.md` puts this at steps 7-10; we are currently sitting between step 5 and step 6.

## Build-order progress (from `CLAUDE.md`)

| # | Step | State | Notes |
|---|---|---|---|
| 1 | Electron shell + Next.js renderer | ✅ done | `electron/main.ts`, `electron:dev` script works |
| 2 | Supabase schema + migrations | ✅ done | `supabase/migrations/2026052300000{1,2,3}*.sql` — books, highlights, embeddings, themes, connections, sessions, storage bucket policies |
| 3 | Library view + import | ✅ done | Anonymous auth, XHR upload with progress, cover extraction (`extractEpubCover`, sharp normalize) |
| 4 | Reader view | ✅ done | `PdfReader.tsx` (pdfjs-dist v4) and `EpubReader.tsx` (epubjs scrolled mode) |
| 5 | Highlight capture | ✅ partial | `createHighlight` persists selection + 150-word context window. **No `reading_sessions` row created, no `highlight/session.ended` event emitted on session close.** |
| 6 | AI panel — explain selection (streamed) | ❌ not wired | `renderer/lib/api/claude.ts` exists but no UI calls it. No Next.js API route exposes it. |
| 7 | Embedding pipeline | ❌ not wired | `renderer/lib/embeddings/voyage.ts` exists; nothing calls it. No `highlight_embeddings` rows ever written. |
| 8 | Background jobs (Inngest) | ❌ stubs only | `inngest/functions/theme-extraction.ts` has TODO helpers (`fetchExistingThemes`, `fetchHighlight`, `persistThemes`). No connection-finding job exists. No Inngest dev runner wired. |
| 9 | Memory surfacing | ❌ stub only | `/memory` route is placeholder. `renderer/lib/memory/search.ts` uses Prisma — won't run from the browser; needs an API route. |
| 10 | Timeline view | ❌ not started | — |

## Active blockers / pollution

### A. Two parallel DB clients (Prisma + Supabase JS)
The renderer uses `@supabase/supabase-js` (`renderer/lib/db/supabase-*.ts`).
`prisma/schema.prisma` and `renderer/lib/db/client.ts` + `repositories/*` also exist
and are exported from `renderer/lib/db/index.ts`. Prisma cannot run in the renderer.

**Decision needed before step 7:** keep Prisma for the *server side* (Inngest +
Next.js API routes) and Supabase JS for the *client side*, or drop one. The Phase 1
design doc (`docs/superpowers/specs/2026-05-23-reader-app-phase-1-design.md`) explicitly
voted to drop Prisma; the implementation kept it. Pick a side and delete the other.

### B. CLAUDE.md is out of date
- Says "Prisma" — partially true (we have Prisma; the renderer doesn't use it).
- Says "Supabase Storage for raw PDF/EPUB" — true; was contested in Phase 1 spec.
- Says model is `claude-sonnet-4-20250514` — pinned in `renderer/lib/api/claude.ts`,
  matches docs. Sonnet 4.6 (`claude-sonnet-4-6`) is available now and would be the
  drop-in upgrade once we actually call the API.

### C. Test suite has 2 failures
```
__tests__/components/BookGrid.test.tsx   — stale: expects 160px max width, real code uses minmax(90px, 120px)
__tests__/components/EpubReader.test.tsx — stale: missing required bookId/userId props
```
Both are out-of-date tests, not real regressions. Either delete or update.

### D. Console.log left in `EpubReader.tsx`
Lines 127, 148, 181 — debug logs from the recent epub-reader fixes. Strip before
moving on.

### E. No reading-session lifecycle
`reading_sessions` table exists; nothing writes to it. `sessionIdRef` in the readers
generates a UUID but nothing closes the session or emits the `highlight/session.ended`
event the Inngest job listens for. Step 8 is blocked on this.

### F. Inngest dev runner not in `npm run dev`
`CLAUDE.md` documents `npx inngest-cli dev` but it isn't a dependency and isn't part
of `electron:dev`. Once step 7-8 work begins this needs to be added.

## Suggested next steps (in order)

1. **Cleanup pass (small, do now)**
   - Fix or delete the 2 failing tests.
   - Strip `console.log` from `EpubReader.tsx`.
   - Update `CLAUDE.md`: clarify Prisma is server-side-only, note recent decisions.

2. **Decide the Prisma question** — pick server-only-Prisma or all-Supabase-JS, then
   delete the losing half. Do this before step 7 lands more code on the wrong side.

3. **Session lifecycle (unblocks step 8)**
   - Create a `reading_sessions` row on reader open (or first scroll).
   - Close it on tab close / route change / 5-min idle.
   - On close, collect highlights tagged with that `session_id` and emit
     `inngest.send({ name: 'highlight/session.ended', data: { highlightIds, userId } })`.

4. **Step 6: Wire AI panel**
   - Add `renderer/app/api/explain/route.ts` that calls `explainHighlight()` from
     `lib/api/claude.ts` and streams to the client.
   - Add the explain UI to `PdfReader`/`EpubReader` — slide-out sidebar, not modal.

5. **Step 7: Embeddings**
   - Server-side Inngest function that, on `highlight.created`, generates the three
     embeddings via Voyage and writes them to `highlight_embeddings`.
   - Emit `highlight.created` from `createHighlight()` (or use a Postgres trigger
     → Supabase webhook → Inngest).

6. **Step 8: Theme extraction + connection-finding**
   - Finish the helpers in `inngest/functions/theme-extraction.ts` (real persistence,
     not TODO stubs).
   - Add connection-finding job: pgvector similarity over `text_context` embeddings,
     threshold 0.78, write to `highlight_connections`.

7. **Step 9: Surfacing**
   - Convert `lib/memory/search.ts` into a Next.js API route (Prisma is fine there).
   - Margin indicator in readers when chapter opens.
   - Daily digest on the library page.

## Files worth knowing about

- `CLAUDE.md` — project brain. Source of truth for product principles.
- `docs/superpowers/specs/2026-05-23-reader-app-phase-1-design.md` — Phase 1 spec.
  Some decisions were reverted (Supabase vs SQLite, Next.js vs Vite). Treat as
  historical context, not current truth.
- `shared/types.ts` — domain types used in both processes. Read this before touching
  the schema.
- `renderer/lib/reader/context.ts` — the 150-word context extraction. **Don't touch
  without re-reading CLAUDE.md's memory rules.** Data not captured here is lost forever.
- `inngest/functions/theme-extraction.ts` — stubs that need finishing; reads
  `CLAUDE_MODEL` from the renderer client (cross-process import — fine because it's
  just a const).
