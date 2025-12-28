alter table titles
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists deleted_at timestamptz;

alter table watch_logs
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists deleted_at timestamptz;

create index if not exists idx_titles_updated_at on titles (updated_at desc);
create index if not exists idx_titles_deleted_at on titles (deleted_at desc);
create index if not exists idx_watch_logs_updated_at on watch_logs (updated_at desc);
create index if not exists idx_watch_logs_deleted_at on watch_logs (deleted_at desc);
