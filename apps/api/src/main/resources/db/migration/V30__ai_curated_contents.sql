create table system_actors (
    id            uuid primary key,
    actor_key     varchar(64) not null unique,
    actor_type    varchar(32) not null,
    display_name  varchar(80) not null,
    disclosure    varchar(255) not null,
    active        boolean not null default true,
    created_at    timestamptz not null default now(),
    constraint system_actors_type_check check (actor_type in ('AI_CURATOR'))
);

create table curated_contents (
    id              uuid primary key,
    actor_id        uuid not null references system_actors(id) on delete restrict,
    title_id        uuid not null references titles(id) on delete cascade,
    locale          varchar(10) not null,
    kind            varchar(16) not null,
    body            text not null,
    status          varchar(16) not null,
    model           varchar(64),
    prompt_version  varchar(64),
    source_json     jsonb not null default '{}'::jsonb,
    content_hash    varchar(128) not null,
    published_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint curated_contents_kind_check check (kind in ('PROMPT')),
    constraint curated_contents_status_check check (status in ('DRAFT', 'PUBLISHED', 'DISABLED')),
    constraint curated_contents_published_at_check check (
        status <> 'PUBLISHED' or published_at is not null
    ),
    constraint curated_contents_body_check check (length(trim(body)) between 1 and 2000),
    unique (actor_id, title_id, locale, kind, content_hash)
);

create index idx_curated_contents_public
    on curated_contents (locale, published_at desc)
    where status = 'PUBLISHED';

insert into system_actors (id, actor_key, actor_type, display_name, disclosure)
values (
    '00000000-0000-4000-8000-000000000001',
    'ottline-curator',
    'AI_CURATOR',
    'ottline 큐레이터',
    'AI 운영 계정'
)
on conflict (actor_key) do nothing;
