CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verify_hash TEXT,
  reset_hash TEXT,
  reset_expires TIMESTAMPTZ,
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT;
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_date DATE NOT NULL,
  return_date TEXT NOT NULL DEFAULT '',
  UNIQUE (origin, destination, depart_date, return_date)
);
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  baggage_included BOOLEAN,
  stops INT,
  airline TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_history_route_ts ON price_history (route_id, timestamp DESC);
CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date TEXT NOT NULL DEFAULT '',
  passengers INT NOT NULL DEFAULT 1,
  cabin TEXT NOT NULL DEFAULT 'economy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_data TEXT NOT NULL,
  confirmation_number TEXT NOT NULL,
  total_price NUMERIC,
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saved_flights (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_date DATE NOT NULL,
  return_date TEXT NOT NULL DEFAULT '',
  passengers INT NOT NULL DEFAULT 1,
  cabin TEXT NOT NULL DEFAULT 'economy',
  flight JSONB NOT NULL,
  saved_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, flight_id, origin, destination, depart_date, return_date)
);
CREATE TABLE IF NOT EXISTS price_alerts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  passengers INT NOT NULL DEFAULT 1,
  cabin TEXT NOT NULL DEFAULT 'economy',
  drop_pct INT NOT NULL DEFAULT 10,
  price_threshold NUMERIC NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  alert_status TEXT NOT NULL DEFAULT 'active',
  last_price NUMERIC,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wayfare trip sync: one document per user; rev is the optimistic-concurrency counter.
-- (Named trip_sync, not wf_sync: production already has a wf_sync that points at wf_users.)
CREATE TABLE IF NOT EXISTS trip_sync (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rev INT NOT NULL DEFAULT 1,
  doc JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
