create table analytics_events (
    event_id uuid primary key,
    user_id uuid references users(id) on delete set null,
    session_id varchar(128) not null,
    event_name varchar(64) not null,
    platform varchar(16) not null check (platform in ('web', 'pwa', 'twa')),
    client_version varchar(64),
    properties jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index idx_analytics_events_occurred_at on analytics_events (occurred_at desc);
create index idx_analytics_events_name_occurred_at on analytics_events (event_name, occurred_at desc);
create index idx_analytics_events_user_occurred_at on analytics_events (user_id, occurred_at desc);
create index idx_analytics_events_platform_occurred_at on analytics_events (platform, occurred_at desc);
