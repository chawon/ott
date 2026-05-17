alter table users
    add column nickname varchar(32),
    add column persona_key varchar(32),
    add column profile_updated_at timestamptz;

alter table users
    add constraint users_persona_key_check
    check (
        persona_key is null
        or persona_key in (
            'cinema_keeper',
            'book_drifter',
            'deep_watcher',
            'midnight_logger',
            'weekend_curator',
            'archive_collector'
        )
    );
