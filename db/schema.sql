-- Wayfare accounts. Tables are wf_-prefixed because they share a Postgres with another app.
CREATE TABLE IF NOT EXISTS wf_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verify_hash TEXT,
  reset_hash TEXT,
  reset_expires TIMESTAMPTZ,
  pw_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One synced document per user; rev is the optimistic-concurrency counter.
CREATE TABLE IF NOT EXISTS wf_sync (
  user_id INT PRIMARY KEY REFERENCES wf_users(id) ON DELETE CASCADE,
  rev INT NOT NULL DEFAULT 1,
  doc JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Fixed-window rate limit counters.
CREATE TABLE IF NOT EXISTS wf_rate (
  key TEXT NOT NULL,
  bucket BIGINT NOT NULL,
  n INT NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket)
);
