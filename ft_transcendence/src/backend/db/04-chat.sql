CREATE TABLE IF NOT EXISTS chat.conversations (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('private', 'channel')),
  name TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent migrations for existing deployments
ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS chat.conversation_participants (
  conversation_id INTEGER NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE chat.conversation_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS chat.messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON chat.messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON chat.messages (conversation_id, created_at);

-- Idempotent migrations for system message support
ALTER TABLE chat.messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('user', 'system'));