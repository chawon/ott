create table if not exists android_notification_devices (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    device_id uuid references user_devices(id) on delete set null,
    install_token_hash varchar(64) not null unique,
    version_name varchar(32),
    version_code integer,
    notification_permission_granted boolean not null default false,
    revisit_reminders_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_bound_at timestamptz not null default now(),
    last_polled_at timestamptz,
    revoked_at timestamptz
);

create index if not exists idx_android_notification_devices_user
    on android_notification_devices (user_id);

create index if not exists idx_android_notification_devices_device
    on android_notification_devices (device_id);

create table if not exists android_notification_deliveries (
    id uuid primary key,
    android_device_id uuid not null references android_notification_devices(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    reminder_type varchar(32) not null,
    dedupe_key varchar(160) not null,
    title varchar(160) not null,
    body text not null,
    deep_link text not null,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    delivered_at timestamptz,
    opened_at timestamptz,
    unique (user_id, dedupe_key)
);

create index if not exists idx_android_notification_deliveries_user_created
    on android_notification_deliveries (user_id, created_at desc);

create index if not exists idx_android_notification_deliveries_device_created
    on android_notification_deliveries (android_device_id, created_at desc);
