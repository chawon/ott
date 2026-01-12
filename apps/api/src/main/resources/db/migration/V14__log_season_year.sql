alter table watch_logs
    add column if not exists season_year int;

alter table watch_log_history
    add column if not exists season_year int;
