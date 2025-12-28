create table if not exists watch_log_history (
                                                 id uuid primary key,
                                                 log_id uuid not null references watch_logs(id) on delete cascade,

    recorded_at timestamptz not null default now(),

    status varchar(16) not null,
    rating numeric(2,1),
    note text,
    spoiler boolean not null,
    ott varchar(64),

    watched_at timestamptz not null,
    place varchar(16),
    occasion varchar(16)
    );

create index if not exists idx_watch_log_history_log_time
    on watch_log_history (log_id, recorded_at desc);
