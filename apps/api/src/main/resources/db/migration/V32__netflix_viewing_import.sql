create table netflix_viewing_events (
    id uuid primary key,
    user_id uuid not null references users(id) on delete cascade,
    source varchar(16) not null default 'NETFLIX',
    source_key varchar(64) not null,
    title_id uuid references titles(id) on delete set null,
    raw_title varchar(500) not null,
    work_title varchar(255) not null,
    viewed_on date not null,
    occurrence int not null,
    season_number int,
    episode_number int,
    created_at timestamptz not null default now(),
    constraint uq_netflix_viewing_source unique (user_id, source, source_key)
);

create index idx_netflix_viewing_user_date
    on netflix_viewing_events (user_id, viewed_on desc, id desc);
create index idx_netflix_viewing_user_title
    on netflix_viewing_events (user_id, title_id)
    where title_id is not null;
