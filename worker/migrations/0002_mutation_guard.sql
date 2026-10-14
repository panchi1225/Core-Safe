ALTER TABLE metadata ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
ALTER TABLE metadata ADD COLUMN entry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE metadata ADD COLUMN excluded_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE mutations (
  ticket TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX mutations_owner ON mutations(owner);
CREATE INDEX mutations_state_time ON mutations(settled,started_at);
