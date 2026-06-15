alter table analytics_events
    drop constraint if exists analytics_events_platform_check;

alter table analytics_events
    add constraint analytics_events_platform_check
    check (platform in ('web', 'pwa', 'twa', 'ios_native'));
