alter table watch_logs
    add column if not exists watched_at timestamptz not null default now();

alter table watch_logs
    add column if not exists place varchar(16);

alter table watch_logs
    add column if not exists occasion varchar(16);

create index if not exists idx_watch_logs_watched_at on watch_logs (watched_at desc);
create index if not exists idx_watch_logs_place on watch_logs (place);
create index if not exists idx_watch_logs_occasion on watch_logs (occasion);
