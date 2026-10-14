-- Content reports (design §7) remember where they were made and what the learner saw, so the exported
-- list stays readable after the content changes.
ALTER TABLE feedback ADD COLUMN lesson_id TEXT;
ALTER TABLE feedback ADD COLUMN nl TEXT;
ALTER TABLE feedback ADD COLUMN zh TEXT;
