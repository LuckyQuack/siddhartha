# Redesign Plan — Local-first + DOM-native reader

> Decided 2026-06-16. Supersedes the cloud-coupled architecture currently in
> `renderer/lib/db/supabase-*.ts`. Aligns with the Phase 1 design spec at
> `docs/superpowers/specs/2026-05-23-reader-app-phase-1-design.md`.

## Why we're rebuilding

1. Supabase project DNS returns NXDOMAIN — the free-tier project paused. Every
   downstream symptom (broken import, broken highlight save, infinite retry
   spinner) traces back to that single cloud dependency.
2. The reader uses an iframe (epubjs) and canvas (pdf.js). Both are opaque to
   Playwright/DOM tooling, so an agent cannot verify whether highlighting works
   without a human watching the screen.
3. The Phase 1 design spec already chose local-first SQLite + DOM-native
   reading. The implementation reverted that decision. We're un-reverting.

## Target architecture

```
Electron Main (Node)                Renderer (Next.js 14)
  electron/main.ts                    renderer/app/page.tsx       — library
  electron/preload.ts                 renderer/app/read/[bookId]  — reader
  electron/db/                        renderer/app/debug/         — agent harness (new)
    client.ts        SQLite           renderer/components/
    migrations/      raw SQL            reader/
    repositories/    typed fns            EpubReader.tsx          — rewrite: HTML
      books.ts                            PdfReader.tsx           — keep canvas, add text overlay
      highlights.ts                       SelectionLayer.tsx      — new: shared selection
      sessions.ts                       library/                  — keep
  electron/ipc/                       renderer/lib/
    file-handlers.ts (keep)             db/api.ts                 — typed window.api wrapper
    db-handlers.ts   (new)              reader/
                                          context.ts              — keep
                                          epub-html.ts            — new: unzip + parse
                                          pdf-text.ts             — new: extract text per page
inngest/  (defer until step 7)
```

**Invariant:** the renderer never talks to the network for app data. All
persistence is `window.api.<entity>.<method>()` → IPC → SQLite. Network calls
are reserved for Claude API and (later) Voyage embeddings, both proxied through
the main process so the renderer never holds API keys.

## Step-by-step (in order, each is one PR/commit)

### 1. SQLite foundation (half day)
- Add `better-sqlite3` (native build — verify it loads inside packaged Electron).
- `electron/db/client.ts` — opens DB at `app.getPath('userData')/siddhartha.db`.
- `electron/db/migrations/001_initial.sql` — books, highlights, reading_sessions.
  Defer embeddings/themes/connections tables to step 5.
- `electron/db/repositories/{books,highlights,sessions}.ts` — typed functions,
  no Prisma.
- Drop `prisma/`, `@prisma/client`, `prisma` from package.json.
- Drop `renderer/lib/db/repositories/` and `renderer/lib/db/client.ts`.

### 2. IPC wiring (half day)
- `electron/ipc/db-handlers.ts` — `db:books:list`, `db:books:create`,
  `db:books:get`, `db:books:update`, `db:highlights:create`,
  `db:highlights:list-by-book`, `db:sessions:start`, `db:sessions:end`.
- `electron/preload.ts` — expose typed `window.api.books.*` etc via
  `contextBridge.exposeInMainWorld`.
- `renderer/lib/db/api.ts` — wraps `window.api.*`, returns typed Promises.
- Update `app/page.tsx` to use `window.api.books.*` instead of Supabase.
- Delete `renderer/lib/db/supabase*.ts` and the Supabase auth glue.
- Drop `@supabase/supabase-js` from package.json.

### 3. Library + import works again (quarter day)
- Books stored locally; `file_path` is the original absolute path on disk
  (no upload). Cover extraction stays the same but writes the PNG to
  `userData/covers/<bookId>.png`.
- Replace the import progress UI's "uploading" phase with just "extracting" +
  "saving". Most of the existing import code stays.
- Acceptance: launch app, import an EPUB, see it in the grid. Reopen the app,
  the book is still there.

### 4. DOM-native EPUB reader (one day) — the agent-debug payoff
- `lib/reader/epub-html.ts`:
  - Use `jszip` to unzip the EPUB.
  - Parse `META-INF/container.xml` → OPF path → spine order.
  - For each chapter, return `{ id, title, html, baseUrl }` where html is the
    raw chapter XHTML with images rewritten to blob URLs.
- `EpubReader.tsx` rewrite:
  - Holds an array of chapter HTML strings.
  - Renders one chapter at a time inside a sandboxed React component using
    `dangerouslySetInnerHTML` (the EPUB content is local + user-provided; no
    XSS source). Scoped styles in a `<style scoped>` block.
  - `mouseup` listener on the article container — pure DOM selection, no
    iframe.
  - Selection lives in the *main* document, so:
    - `window.getSelection()` works.
    - Playwright can drive selection via `page.evaluate` or
      `page.mouse.down/up`.
    - The agent can dump `selectedText`, `contextBefore`, `contextAfter` as
      `data-*` attributes on a debug element for inspection.
- Acceptance: open an EPUB, select 2 sentences, see the selection toolbar
  appear, click save, verify a row in SQLite via `db:highlights:list-by-book`.

### 5. PDF reader: keep canvas, fix selection (half day)
- Keep canvas render (visual fidelity matters for PDFs).
- pdfjs already provides `renderTextLayer` — the existing code uses it. The
  fix is making the text layer the primary selection surface and disabling
  pointer events on the canvas. This is a small CSS change, not a rewrite.
- Same `SelectionLayer.tsx` component as EPUB — shared selection toolbar.
- Acceptance: open a PDF, select text across the text layer, save highlight,
  confirm row in SQLite.

### 6. Agent debug harness (quarter day) — the new capability
- `renderer/app/debug/highlight/page.tsx`:
  - Loads a fixture HTML chapter (committed to repo, ~2KB) into the reader
    selection component.
  - Buttons: "Simulate selection of paragraph 1", "Get last captured highlight
    state", "Reset".
  - The captured state is mirrored to a global `window.__siddhartha_debug`
    object for Playwright to read.
- `__tests__/e2e/highlight.spec.ts` (new — needs Playwright):
  - Launches the Next.js dev server (no Electron needed for this route).
  - Navigates to `/debug/highlight`, runs the simulated selection, asserts the
    captured `selectedText`/`contextBefore`/`contextAfter` match expected.
- This is the routine an agent runs after touching any selection code, instead
  of "please look at the screen and tell me if it works".

### 7. Reading session lifecycle (quarter day)
- On reader mount: `window.api.sessions.start({ bookId })` → returns sessionId.
- On unmount or 5-min idle: `window.api.sessions.end({ sessionId })`.
- `createHighlight` accepts `session_id` (already does — just wire it).
- This unblocks the memory pipeline whenever we get there.

### 8. Memory engine (deferred — step 7 of CLAUDE.md build order)
- Stays cloud (Voyage + remote pgvector or sqlite-vec).
- Triggered as Inngest jobs OR a local worker process; agnostic at this point.
- Don't build until reading + capture work end-to-end locally.

## What we're explicitly NOT doing

- No Prisma. Repository pattern via typed functions over `better-sqlite3`.
- No Supabase JS in the renderer. (Optional cloud sync layer can be added
  later as a *background* process that reads SQLite and pushes to a backend.)
- No iframe in the EPUB reader. No `react-reader` dependency.
- No Next.js server-side rendering for `/read/[bookId]` — it's all client.
- No auth wall. A single local "user_id" generated on first launch.

## Risk register

- **`better-sqlite3` native module + electron-builder**: needs
  `electron-rebuild` or a postinstall script. Verify in step 1, not at packaging
  time.
- **EPUB rendering fidelity**: epubjs handles a lot of edge cases (footnotes,
  RTL, custom fonts). DOM-native means we re-implement the basics. Start with
  Project Gutenberg books to keep it sane; document the limitation in
  `CLAUDE.md`.
- **PDF text-layer alignment**: pdf.js text layer is positioned absolutely over
  the canvas. Any zoom/scroll bug shows up immediately. Existing code already
  handles this; the change is purely about which layer captures pointer events.
- **Migration**: anyone who imported books to the current Supabase setup loses
  them. Acceptable — pre-release, no real users.

## Definition of done

- `npm run electron:dev` opens app; import an EPUB; reader opens; select
  text; click save; close app; reopen; book and highlight still there.
- `npm test` passes (including new Playwright E2E for `/debug/highlight`).
- Zero network calls during the happy path (verify via DevTools Network tab).
- `docs/PROJECT_STATUS.md` updated: steps 1-5 of `CLAUDE.md` build order
  marked done, step 6 (AI panel) becomes the next target.
