alter table user_devices
    add column if not exists user_agent text,
    add column if not exists os varchar(64),
    add column if not exists browser varchar(64);
