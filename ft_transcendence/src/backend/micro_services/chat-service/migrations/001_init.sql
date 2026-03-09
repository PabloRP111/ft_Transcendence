-- Migration 001: Initial schema
-- This file is idempotent: safe to run multiple times (uses IF NOT EXISTS).

-- pgcrypto gives us gen_random_uuid() for generating UUID primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- conversations: a conversation can be a private DM between two users
-- or a named channel with multiple participants.
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('private', 'channel')),
  name       TEXT,                          -- nullable: DMs don't need a name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- conversation_participants: which users belong to which conversation.
-- user_id is not a foreign key to a users table because this service
-- does not own user data — it only stores the UUID from the JWT.
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)  -- one row per user per conversation
);

-- messages: every message sent in any conversation.
-- edited_at is NULL until the message is edited at least once.
CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at       TIMESTAMPTZ           -- NULL means never edited
);

-- Index for fetching all messages in a conversation (used in GET /conversations/:id/messages).
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages (conversation_id);

-- Composite index for cursor-based pagination: filters by conversation,
-- then sorts by time. This makes paginated queries fast even with many messages.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);
