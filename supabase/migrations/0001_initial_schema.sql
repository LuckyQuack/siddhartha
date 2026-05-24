-- Migration 0001: initial schema
-- Enables pgvector and creates all core tables with RLS policies.
-- Reversible: see the rollback section at the bottom.

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── books ─────────────────────────────────────────────────────────────────────
create table books (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users on delete cascade,
  title         text not null,
  author        text,
  file_path     text,
  file_type     text check (file_type in ('pdf', 'epub')),
  cover_url     text,
  total_pages   int,
  created_at    timestamptz not null default now(),
  last_opened   timestamptz
);

alter table books enable row level security;
create policy "Users see own books"   on books for select using (auth.uid() = user_id);
create policy "Users insert own books" on books for insert with check (auth.uid() = user_id);
create policy "Users update own books" on books for update using (auth.uid() = user_id);
create policy "Users delete own books" on books for delete using (auth.uid() = user_id);

-- ── highlights ────────────────────────────────────────────────────────────────
create table highlights (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users on delete cascade,
  book_id         uuid not null references books on delete cascade,
  selected_text   text not null,
  context_before  text not null,   -- 150 words before — never nullable
  context_after   text not null,   -- 150 words after  — never nullable
  user_note       text,
  chapter         text,
  page_number     int,
  position_pct    float check (position_pct between 0 and 1),
  session_id      uuid,
  created_at      timestamptz not null default now()
);

alter table highlights enable row level security;
create policy "Users see own highlights"    on highlights for select using (auth.uid() = user_id);
create policy "Users insert own highlights" on highlights for insert with check (auth.uid() = user_id);
create policy "Users update own highlights" on highlights for update using (auth.uid() = user_id);
create policy "Users delete own highlights" on highlights for delete using (auth.uid() = user_id);

-- ── highlight_embeddings ──────────────────────────────────────────────────────
create table highlight_embeddings (
  id              uuid primary key default uuid_generate_v4(),
  highlight_id    uuid not null references highlights on delete cascade,
  embedding_type  text not null check (embedding_type in ('text', 'text_context', 'note')),
  embedding       vector(1024) not null,
  model           text not null,
  created_at      timestamptz not null default now()
);

-- hnsw index for fast approximate nearest-neighbour search.
-- cosine distance matches the similarity metric used in connection-finding.
create index highlight_embeddings_embedding_hnsw
  on highlight_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table highlight_embeddings enable row level security;
create policy "Users see own embeddings" on highlight_embeddings
  for select using (
    exists (
      select 1 from highlights h
      where h.id = highlight_id and h.user_id = auth.uid()
    )
  );

-- ── highlight_themes ──────────────────────────────────────────────────────────
create table highlight_themes (
  id            uuid primary key default uuid_generate_v4(),
  highlight_id  uuid not null references highlights on delete cascade,
  theme         text not null,
  confidence    float not null check (confidence between 0 and 1),
  created_at    timestamptz not null default now()
);

alter table highlight_themes enable row level security;
create policy "Users see own themes" on highlight_themes
  for select using (
    exists (
      select 1 from highlights h
      where h.id = highlight_id and h.user_id = auth.uid()
    )
  );

-- ── highlight_connections ─────────────────────────────────────────────────────
create table highlight_connections (
  id            uuid primary key default uuid_generate_v4(),
  highlight_a   uuid not null references highlights on delete cascade,
  highlight_b   uuid not null references highlights on delete cascade,
  similarity    float not null check (similarity between 0 and 1),
  shared_themes text[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (highlight_a, highlight_b)
);

alter table highlight_connections enable row level security;
create policy "Users see own connections" on highlight_connections
  for select using (
    exists (
      select 1 from highlights h
      where h.id = highlight_a and h.user_id = auth.uid()
    )
  );

-- ── reading_sessions ──────────────────────────────────────────────────────────
create table reading_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users on delete cascade,
  book_id     uuid not null references books on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  pages_read  int
);

alter table reading_sessions enable row level security;
create policy "Users see own sessions"    on reading_sessions for select using (auth.uid() = user_id);
create policy "Users insert own sessions" on reading_sessions for insert with check (auth.uid() = user_id);
create policy "Users update own sessions" on reading_sessions for update using (auth.uid() = user_id);

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- drop table if exists reading_sessions cascade;
-- drop table if exists highlight_connections cascade;
-- drop table if exists highlight_themes cascade;
-- drop table if exists highlight_embeddings cascade;
-- drop table if exists highlights cascade;
-- drop table if exists books cascade;
-- drop extension if exists "vector";
-- drop extension if exists "uuid-ossp";
