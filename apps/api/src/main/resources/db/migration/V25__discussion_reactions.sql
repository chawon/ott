create table if not exists discussion_reactions (
    id uuid primary key,
    discussion_id uuid not null references discussions(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    type varchar(16) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(discussion_id, user_id)
);

create index if not exists idx_discussion_reactions_discussion
    on discussion_reactions (discussion_id, type);

create index if not exists idx_discussion_reactions_user
    on discussion_reactions (user_id);
