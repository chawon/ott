alter table watch_logs
    add column if not exists origin varchar(16) not null default 'LOG';

alter table watch_log_history
    add column if not exists origin varchar(16);
