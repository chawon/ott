create table if not exists feedback_threads (
    id uuid primary key,
    user_id uuid not null references users(id),
    category varchar(32) not null,
    status varchar(32) not null,
    subject varchar(120),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_feedback_threads_user_updated_at
    on feedback_threads (user_id, updated_at desc);

create index if not exists idx_feedback_threads_status_updated_at
    on feedback_threads (status, updated_at desc);

create table if not exists feedback_messages (
    id uuid primary key,
    thread_id uuid not null references feedback_threads(id) on delete cascade,
    author_role varchar(16) not null,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_feedback_messages_thread_created_at
    on feedback_messages (thread_id, created_at asc);
