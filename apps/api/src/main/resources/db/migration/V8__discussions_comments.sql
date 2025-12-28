alter table watch_logs
    add column if not exists user_id uuid;

create index if not exists idx_watch_logs_user_id on watch_logs (user_id);
create unique index if not exists uq_watch_logs_user_title
    on watch_logs (user_id, title_id)
    where user_id is not null and deleted_at is null;

create table if not exists discussions (
    id uuid primary key,
    title_id uuid not null references titles(id) on delete cascade,
    comment_seq int not null default 0,
    created_at timestamptz not null default now(),
    unique(title_id)
);

create table if not exists comments (
    id uuid primary key,
    discussion_id uuid not null references discussions(id) on delete cascade,
    user_id uuid,
    author_name varchar(255) not null,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_comments_discussion_time on comments (discussion_id, created_at asc);
