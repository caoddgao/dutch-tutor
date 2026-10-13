-- Latest score for each stage test or mock exam section. Repeated attempts replace the displayed score.
CREATE TABLE exam_results (
  id TEXT PRIMARY KEY NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  taken_at TEXT NOT NULL
);
