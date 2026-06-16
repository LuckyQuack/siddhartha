# Agent Harness — read this before you do anything

You're a fresh agent landing in this repo. This file orients you in <2 minutes
so you don't waste a turn re-deriving what's already known.

## Read order (do not skip)

1. `CLAUDE.md` — product principles, schema, build order. The non-negotiables.
2. `docs/PROJECT_STATUS.md` — what's actually done vs. what `CLAUDE.md` claims.
   Audited periodically. Re-run the verification commands below to confirm it's
   still accurate before making big decisions.
3. This file — workflow + gotchas.

## The repo in 30 seconds

```
Electron main (Node)              Renderer (Next.js 14 App Router)
  electron/main.ts                  renderer/app/page.tsx       — library
  electron/preload.ts               renderer/app/read/[bookId]  — reader
  electron/ipc/                     renderer/app/memory         — placeholder
    file-handlers.ts                renderer/components/
    metadata-extractor.ts             library/ reader/ ui/
                                    renderer/lib/
                                      api/claude.ts             — AI client (unused so far)
                                      db/supabase-*.ts          — browser DB
                                      db/repositories/*.ts      — Prisma (server only)
                                      embeddings/voyage.ts      — unused so far
                                      memory/search.ts          — Prisma; needs API route
                                      reader/context.ts         — 150-word capture
inngest/
  client.ts
  functions/theme-extraction.ts     — stubs (TODO helpers)

supabase/migrations/                 — schema + RLS + storage bucket
prisma/schema.prisma                 — mirror of the SQL schema for server-side use
shared/types.ts                      — domain types used in both processes
```

## Verification commands (run before claiming things work)

```bash
# Type-check both processes
npm run tsc:renderer
npm run tsc:electron

# Run tests (currently 2 stale failures — see PROJECT_STATUS §C)
npm test

# Build the renderer (catches Next.js issues type-check misses)
npm run build

# Run the app for manual UI testing
npm run electron:dev
```

If you change anything in the renderer that imports `@/lib/db/repositories/*`,
Prisma, or Inngest — verify it does not get pulled into the client bundle.
Those are server-only.

## Gotchas (real ones, not hypothetical)

- **Prisma cannot run in the renderer.** `renderer/lib/db/index.ts` exports both
  Prisma and Supabase clients. Components must use the Supabase JS client; only
  API routes / Inngest functions can use Prisma. See PROJECT_STATUS §A.
- **150-word context is sacred.** `renderer/lib/reader/context.ts` collects
  `context_before` and `context_after`. Never short-circuit, optimize away, or
  null these. See `CLAUDE.md` "Memory system — critical rules".
- **AI calls must be streamed.** `claude.ts` does it via SSE→TextDecoderStream
  pipeline. Don't introduce non-streaming callers.
- **Three embeddings per highlight.** `text`, `text_context`, `note`
  (last only when user_note is non-null). Embedding pipeline is not yet built.
- **Inngest jobs must be idempotent.** The stub `extract-themes` checks for
  existing themes before re-extracting. New jobs must do the same shape.
- **Importing only works in the desktop app.** The library page surfaces an
  explicit error when run via `npm run dev` alone (no `window.electron`).
  Don't be confused by this when testing in a browser.
- **Anonymous Supabase auth** is the only auth right now. If sign-in fails,
  it surfaces in the UI ("Auth error… enable Anonymous sign-ins in Supabase
  dashboard"). Real auth is deferred.
- **Cover URLs are signed for 1 year** (`uploadWithProgress` in `app/page.tsx`).
  `BookCard` has an `onError` fallback when they expire.
- **EPUB reader** uses epubjs in `flow: 'scrolled'`, `manager: 'continuous'`.
  Recent commits fixed selection capture by listening on the iframe document's
  `mouseup` rather than fighting iframe z-index.
- **PDF text layer is best-effort.** `renderTextLayer` is called inside a
  try/catch; selection still works at the canvas level if it fails.

## Workflow conventions

- **Plan-mode-first for memory work.** Any change touching highlights,
  embeddings, themes, connections, or the AI panel — use `/memory-task` (loads
  the checklist in `.claude/commands/memory-task.md`).
- **Plan-mode-first for schema work.** Use `/db-migration`. Migrations are
  versioned, reversible, include RLS.
- **Commit style:** plain English. No `feat:`/`fix:` prefix. Author as
  Johnathan Vu. (Stored in auto-memory `feedback_git_commits.md`.)
- **Don't add Co-Authored-By.** Disabled globally.
- **Don't run the dev server in the background** unless asked — leaves stale
  processes on Windows.

## When you're stuck

- Schema confusion → `supabase/migrations/` is the source of truth; Prisma
  schema mirrors it.
- Types confusion → `shared/types.ts`.
- "Where is X called from?" → `Grep` first, don't spawn agents.
- "Did we decide X?" → check `docs/PROJECT_STATUS.md` and Phase 1 design spec.
  If neither answers it, ask the user before guessing.

## Updating this harness

When you finish a meaningful chunk of work (a build-order step, a major
refactor, a stack decision), update:
1. `docs/PROJECT_STATUS.md` — move the step from ❌ to ✅, update blockers.
2. `CLAUDE.md` — only if a *principle* or *invariant* changed.
3. This file — only if a workflow or gotcha actually changed.

Don't update for cosmetic fixes. The point is keeping the next agent honest,
not narrating progress.
