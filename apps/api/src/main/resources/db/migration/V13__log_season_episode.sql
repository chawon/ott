alter table watch_logs
    add column if not exists season_number int;

alter table watch_logs
    add column if not exists episode_number int;

alter table watch_logs
    add column if not exists season_poster_url text;

alter table watch_log_history
    add column if not exists season_number int;

alter table watch_log_history
    add column if not exists episode_number int;

alter table watch_log_history
    add column if not exists season_poster_url text;
