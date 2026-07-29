create table book_classifications (
    isbn13      varchar(13) primary key,
    kdc_code    varchar(32),
    kdc_major   integer,
    status      varchar(16) not null,
    source      varchar(32) not null default 'DATA4LIBRARY',
    fetched_at  timestamptz not null default now(),
    constraint book_classifications_kdc_major_check
        check (kdc_major is null or (kdc_major between 0 and 9)),
    constraint book_classifications_status_check
        check (status in ('RESOLVED', 'NOT_FOUND'))
);

create index idx_book_classifications_status_fetched_at
    on book_classifications (status, fetched_at);
