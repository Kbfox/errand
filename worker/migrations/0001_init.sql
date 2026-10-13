CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  vault_id TEXT,
  vault_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rules (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  auto_under_usd REAL NOT NULL DEFAULT 0,      -- 0 = never buy without asking
  monthly_cap_usd REAL NOT NULL DEFAULT 0,     -- 0 = no cap
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                         -- PayPal order id
  user_id TEXT NOT NULL REFERENCES users(id),
  candidate_json TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,                        -- CREATED | COMPLETED | CANCELLED | SHIPPED
  mode TEXT NOT NULL,                          -- approved | auto | watch
  capture_id TEXT,
  tracking_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  candidate_json TEXT NOT NULL,
  target_price REAL NOT NULL,
  last_price REAL,
  status TEXT NOT NULL DEFAULT 'active',       -- active | bought | needs_approval | cancelled
  order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_at TEXT
);
CREATE INDEX IF NOT EXISTS watches_user ON watches(user_id, created_at DESC);
