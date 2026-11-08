create table recommendation_account_state (
    user_id uuid primary key references users(id) on delete cascade,
    quota_date date not null,
    successful_count integer not null default 0 check (successful_count between 0 and 3),
    lease_id uuid,
    lease_expires_at timestamptz,
    updated_at timestamptz not null default now()
);

create table recommendation_batches (
    user_id uuid not null references users(id) on delete cascade,
    language varchar(8) not null,
    generation_id uuid not null,
    provider_key varchar(255) not null,
    items_json text not null,
    generated_at timestamptz not null,
    primary key (user_id, language)
);

create table recommendation_generation_attempts (
    user_id uuid not null references users(id) on delete cascade,
    request_id uuid not null,
    owner_request_id uuid,
    language varchar(8) not null,
    status varchar(16) not null check (status in ('PENDING', 'COMPLETED', 'FAILED')),
    started_at timestamptz not null,
    completed_at timestamptz,
    primary key (user_id, request_id)
);

create table recommendation_exclusions (
    user_id uuid not null references users(id) on delete cascade,
    exclusion_key varchar(64) not null,
    item_json text not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, exclusion_key)
);
