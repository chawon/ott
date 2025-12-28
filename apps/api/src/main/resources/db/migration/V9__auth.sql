create table if not exists users (
    id uuid primary key,
    pairing_code varchar(16) not null unique,
    created_at timestamptz not null default now()
);

create table if not exists user_devices (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

create index if not exists idx_user_devices_user on user_devices (user_id);
