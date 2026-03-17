\connect gateway_db;

CREATE TABLE sessions (
  user_id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  refresh_expires_at BIGINT NOT NULL,
  last_access_expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);