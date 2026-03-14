ALTER TABLE discussions ADD COLUMN locale VARCHAR(10) DEFAULT 'ko' NOT NULL;
CREATE INDEX idx_discussions_locale ON discussions(locale);
