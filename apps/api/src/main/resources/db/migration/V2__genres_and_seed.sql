alter table titles
    add column if not exists genres text[] not null default '{}';

insert into titles (id, type, name, year, overview, poster_url, genres)
values
    ('11111111-1111-1111-1111-111111111111', 'movie',  'Dune: Part Two', 2024, null, null, array['SF','Adventure']),
    ('22222222-2222-2222-2222-222222222222', 'series', 'The Bear',       2022, null, null, array['Drama','Comedy']),
    ('33333333-3333-3333-3333-333333333333', 'movie',  'Parasite',       2019, null, null, array['Thriller','Drama']),
    ('44444444-4444-4444-4444-444444444444', 'series', 'Severance',      2022, null, null, array['SF','Mystery']),
    ('55555555-5555-5555-5555-555555555555', 'movie',  'Inside Out',     2015, null, null, array['Animation','Family'])
    on conflict (id) do nothing;
