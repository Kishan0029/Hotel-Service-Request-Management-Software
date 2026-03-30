-- ============================================================
-- V7 Migration — Email/Password Auth, Locations, Photo URLs
-- Run in Supabase SQL Editor AFTER v6_migration.sql
-- All statements are idempotent (safe to re-run)
-- ============================================================

-- ── SECTION 1: Add email + password to staff ─────────────────
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password TEXT;

-- Unique index on email (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email
  ON staff (email)
  WHERE email IS NOT NULL;

-- ── SECTION 2: Seed default credentials for existing staff ────
-- Default password: password123 (should be changed in production)
UPDATE staff
SET
  email    = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g'), ' +', '.', 'g')) || '@hotel.com',
  password = 'password123'
WHERE email IS NULL;

-- ── SECTION 3: Create locations table ────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'area'
               CHECK (type IN ('room', 'area')),
  floor      INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE locations IS 'Hotel locations: both specific rooms and general areas.';

-- Seed common hotel areas
INSERT INTO locations (name, type) VALUES
  ('Lobby',            'area'),
  ('Pool Area',        'area'),
  ('Restaurant',       'area'),
  ('Gym',              'area'),
  ('Spa',              'area'),
  ('Corridor Floor 1', 'area'),
  ('Corridor Floor 2', 'area'),
  ('Corridor Floor 3', 'area'),
  ('Banquet Hall',     'area'),
  ('Parking Area',     'area'),
  ('Reception Area',   'area'),
  ('Elevator Lobby',   'area')
ON CONFLICT DO NOTHING;

-- Populate locations from existing rooms (safe re-run)
INSERT INTO locations (name, type, floor)
SELECT 'Room ' || room_number, 'room', floor
FROM rooms
WHERE NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE l.name = 'Room ' || rooms.room_number AND l.type = 'room'
);

-- ── SECTION 4: Add new columns to tasks ──────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS before_photo_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS after_photo_url  TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_mod_task      BOOLEAN DEFAULT FALSE;

-- ── SECTION 5: Add 'reception' to staff role constraint ──────
-- (Idempotent - may already exist from v5)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('staff', 'supervisor', 'manager', 'gm', 'reception'));

-- ── SECTION 6: Indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_locations_type
  ON locations (type);

CREATE INDEX IF NOT EXISTS idx_tasks_location_id
  ON tasks (location_id);

CREATE INDEX IF NOT EXISTS idx_tasks_is_mod
  ON tasks (is_mod_task)
  WHERE is_mod_task = true;

-- ── SECTION 7: Verify (optional) ─────────────────────────────
-- SELECT id, name, email, password, role FROM staff ORDER BY role, name;
-- SELECT id, name, type FROM locations ORDER BY type, name;
-- SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('before_photo_url','after_photo_url','location_id','is_mod_task');

-- ============================================================
-- END OF V7 MIGRATION
-- ============================================================
