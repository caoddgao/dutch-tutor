-- Pronunciation practice page (design §7, decision 29).
-- The Azure score of a practice take (JSON: total, accuracy, fluency, completeness, low_words), shown with
-- the take; takes made without scoring keep NULL.
ALTER TABLE recordings ADD COLUMN assessment TEXT;
