\connect gateway_db;

CREATE TABLE sessions (
  user_id INTEGER PRIMARY KEY,
  refresh_expires_at BIGINT NOT NULL,
  last_access_expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);