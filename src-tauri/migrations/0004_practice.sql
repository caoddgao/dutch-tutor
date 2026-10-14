-- Pronunciation practice page (design §7, decision 29).
-- The Azure score of a practice take (JSON: total, accuracy, fluency, completeness, low_words), shown with
-- the take; takes made without scoring keep NULL.
ALTER TABLE recordings ADD COLUMN assessment TEXT;

-- "My hard sentences": sentences starred on the practice page to practise again (in the backup).
CREATE TABLE hard_sentences (
  sentence_id TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
