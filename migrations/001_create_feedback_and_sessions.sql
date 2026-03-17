CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'irrelevant', 'inaccurate')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  city TEXT NOT NULL,
  feed_item_count INT,
  cards_viewed INT DEFAULT 0,
  scroll_depth REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
