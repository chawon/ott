ALTER TABLE titles
    ADD COLUMN directors text[] NOT NULL DEFAULT '{}',
    ADD COLUMN cast_names text[] NOT NULL DEFAULT '{}';
