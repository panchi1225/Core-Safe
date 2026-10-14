CREATE TABLE fixture_control (id INTEGER PRIMARY KEY CHECK(id=1), marker TEXT NOT NULL, version INTEGER NOT NULL, active INTEGER NOT NULL, expires_at INTEGER NOT NULL, sync_fail INTEGER NOT NULL DEFAULT 0);
INSERT INTO fixture_control(id,marker,version,active,expires_at) VALUES(1,'core-safe-synthetic-staging-v1',1,0,0);
CREATE TABLE fixture_employees (id TEXT PRIMARY KEY, fields_json TEXT NOT NULL);
