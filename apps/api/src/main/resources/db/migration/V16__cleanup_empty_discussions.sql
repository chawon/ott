delete from discussions d
where not exists (
    select 1
    from comments c
    where c.discussion_id = d.id
);
