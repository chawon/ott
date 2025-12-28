alter table titles
    add column if not exists provider varchar(16) not null default 'LOCAL';

alter table titles
    add column if not exists provider_id varchar(32);

create unique index if not exists uq_titles_provider_provider_id
    on titles(provider, provider_id)
    where provider_id is not null;
