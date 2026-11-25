-- User edit timestamps remain conflict versions, never delivery checkpoints.
-- Writers append in their own transaction; only committed receipts are published by pull.
create table sync_delivery_clock (
    id integer primary key check (id = 1),
    watermark timestamptz not null
);
insert into sync_delivery_clock values (1, '1970-01-01T00:00:00Z');

create table sync_pending_changes (
    id bigserial primary key,
    entity_type varchar(8) not null check (entity_type in ('title', 'log')),
    entity_id uuid not null
);
create index idx_sync_pending_entity on sync_pending_changes(entity_type, entity_id);

create table sync_deliveries (
    entity_type varchar(8) not null check (entity_type in ('title', 'log')),
    entity_id uuid not null,
    delivered_at timestamptz not null,
    primary key (entity_type, entity_id)
);
create index idx_sync_deliveries_since on sync_deliveries(entity_type, delivered_at, entity_id);

-- An old installation repairs pre-V33 gaps before its first acknowledged new cursor.
-- An unrecognized cursor (including an old API Pod's wall clock) repairs again.
create table sync_device_cursors (
    device_id uuid primary key references user_devices(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    issued_cursor timestamptz not null
);

create function capture_sync_change() returns trigger language plpgsql as $$
begin
    if tg_op = 'DELETE' then
        -- Account deletion and canonical merge physically remove rows. Their devices are
        -- revoked by the existing flow; retain no delivery metadata for removed records.
        delete from sync_deliveries where entity_type = tg_argv[0] and entity_id = old.id;
        delete from sync_pending_changes where entity_type = tg_argv[0] and entity_id = old.id;
        return old;
    end if;
    if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
    -- Append, do not coalesce or use this sequence as a checkpoint: commits may reverse.
    insert into sync_pending_changes(entity_type, entity_id) values (tg_argv[0], new.id);
    return new;
end;
$$;

create trigger titles_sync_change after insert or update or delete on titles
    for each row execute function capture_sync_change('title');
create trigger logs_sync_change after insert or update or delete on watch_logs
    for each row execute function capture_sync_change('log');
