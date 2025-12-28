create table titles (
                        id           uuid primary key,
                        type         varchar(16) not null,
                        name         varchar(255) not null,
                        year         int,
                        overview     text,
                        poster_url   text,
                        created_at   timestamptz not null default now()
);

create index idx_titles_name on titles (name);

create table watch_logs (
                            id          uuid primary key,
                            title_id    uuid not null references titles(id),
                            status      varchar(16) not null,
                            rating      numeric(2,1),
                            note        text,
                            spoiler     boolean not null default false,
                            ott         varchar(255),
                            created_at  timestamptz not null default now()
);

create index idx_watch_logs_created_at on watch_logs (created_at desc);
create index idx_watch_logs_status on watch_logs (status);
create index idx_watch_logs_ott on watch_logs (ott);
