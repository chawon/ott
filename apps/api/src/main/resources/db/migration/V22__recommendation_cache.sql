create table recommendation_cache (
    user_id       uuid primary key,
    language      varchar(8) not null default 'ko',
    response_json text not null,
    created_at    timestamptz not null default now()
);
