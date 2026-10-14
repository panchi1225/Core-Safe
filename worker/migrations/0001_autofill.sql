CREATE TABLE roster (
  generation TEXT NOT NULL,
  selection_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  dob_mac TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  PRIMARY KEY (generation, selection_id)
);
CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), generation TEXT NOT NULL, synced_at INTEGER NOT NULL);
INSERT INTO metadata VALUES(1, '', 0);
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK(id=1), generation TEXT NOT NULL, owner TEXT NOT NULL,
  encrypted_state TEXT NOT NULL, expires_at INTEGER NOT NULL, busy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE gates (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
CREATE INDEX gates_expiry ON gates(expires_at);
CREATE TABLE days (key TEXT PRIMARY KEY, used INTEGER NOT NULL);
