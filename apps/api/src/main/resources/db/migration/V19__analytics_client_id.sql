alter table analytics_events
    add column if not exists client_id uuid;

create index if not exists idx_analytics_events_client_occurred_at
    on analytics_events (client_id, occurred_at desc);
