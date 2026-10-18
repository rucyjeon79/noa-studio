create table if not exists studio_pages (
  slot text primary key,
  kind text not null,
  genre_id text not null,
  ep text not null default '',
  act integer not null default 1,
  title text not null default '',
  body jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists studio_pages_genre_idx on studio_pages (genre_id);
create index if not exists studio_pages_kind_idx on studio_pages (kind, genre_id);
