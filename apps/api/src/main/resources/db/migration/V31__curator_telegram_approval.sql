create table curated_telegram_state (
    id integer primary key check (id = 1),
    next_update_id bigint not null default 0
);
insert into curated_telegram_state(id) values (1);

create table curated_telegram_reviews (
    content_id uuid primary key references curated_contents(id) on delete cascade,
    generation_date date not null,
    chat_id text not null,
    revision integer not null default 0,
    rendered_revision integer not null default -1,
    message_id bigint,
    reviewed_body text not null,
    rendered_status varchar(16),
    next_delivery_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
create index idx_curated_telegram_generation_date on curated_telegram_reviews(generation_date);

create table curated_telegram_actions (
    update_id bigint primary key,
    content_id uuid not null references curated_contents(id) on delete cascade,
    telegram_user_id bigint not null,
    action varchar(16) not null,
    revision integer not null,
    body text not null,
    created_at timestamptz not null default now()
);
