alter table titles
    add column if not exists author varchar(255);

alter table titles
    add column if not exists publisher varchar(255);

alter table titles
    add column if not exists isbn10 varchar(10);

alter table titles
    add column if not exists isbn13 varchar(13);

alter table titles
    add column if not exists pubdate varchar(8);

alter table titles
    alter column provider_id type varchar(64);
