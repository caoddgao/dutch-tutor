-- Dutch Tutor local database, schema version 1.
-- Applied by tauri-plugin-sql on startup. Never edit after release; add a new migration instead.

-- Key/value settings. value is JSON.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Per-lesson progress. Status: new / studied / mastered.
CREATE TABLE lesson_progress (
  lesson_id       TEXT PRIMARY KEY NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'studied', 'mastered')),
  current_step    INTEGER NOT NULL DEFAULT 0,  -- 0..5, see design §3
  current_index   INTEGER NOT NULL DEFAULT 0,  -- position inside the step
  completed_count INTEGER NOT NULL DEFAULT 0,
  first_completed_at TEXT,
  last_studied_at TEXT,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Review schedule for sentences and words (design §4).
CREATE TABLE review_items (
  item_id          TEXT PRIMARY KEY NOT NULL,
  item_type        TEXT NOT NULL CHECK (item_type IN ('sentence', 'word')),
  lesson_id        TEXT NOT NULL,
  stage            INTEGER NOT NULL DEFAULT 0,
  interval_days    REAL NOT NULL DEFAULT 0,
  due_at           TEXT NOT NULL,
  last_reviewed_at TEXT,
  reps             INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_review_items_due ON review_items (due_at);
CREATE INDEX idx_review_items_lesson ON review_items (lesson_id);

-- Every review answer. mode: R1 / R2 / R3; result: good / fuzzy / bad.
CREATE TABLE review_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('R1', 'R2', 'R3')),
  result      TEXT NOT NULL CHECK (result IN ('good', 'fuzzy', 'bad')),
  source      TEXT NOT NULL CHECK (source IN ('daily', 'lesson', 'mistakes')),
  reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_review_log_item ON review_log (item_id, reviewed_at);

-- Recording index. kind: practice (learner's own takes, last 3 kept) / voice (real-voice source, recording mode).
CREATE TABLE recordings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  audio_id    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('practice', 'voice')),
  file_path   TEXT NOT NULL,
  duration    REAL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_recordings_audio ON recordings (audio_id, kind, created_at);

-- Content error reports and "unnatural sentence" marks, exported for later revision.
CREATE TABLE feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('sentence', 'word', 'exercise', 'tip', 'audio')),
  target_id   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  exported_at TEXT
);

-- One row per day with study activity (streak / study days).
CREATE TABLE study_days (
  day               TEXT PRIMARY KEY NOT NULL,  -- local date YYYY-MM-DD
  sentences_learned INTEGER NOT NULL DEFAULT 0,
  reviews_done      INTEGER NOT NULL DEFAULT 0
);
