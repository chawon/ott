create table chatgpt_oauth_authorization_codes (
    code varchar(128) primary key,
    client_id text not null,
    redirect_uri text not null,
    code_challenge varchar(256) not null,
    scopes text not null,
    resource text,
    user_id uuid not null,
    device_id uuid not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz
);

create index idx_chatgpt_oauth_codes_expires_at
    on chatgpt_oauth_authorization_codes (expires_at);
