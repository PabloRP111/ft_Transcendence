CREATE TABLE IF NOT EXISTS auth.friendships (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id   ON auth.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON auth.friendships(friend_id);
