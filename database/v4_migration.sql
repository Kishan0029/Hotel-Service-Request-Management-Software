-- ============================================================
-- V4 Migration — Hierarchical Task Assignment Flow
-- Run in Supabase SQL Editor AFTER v3_migration.sql.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- ── SECTION 1: New task columns ───────────────────────────────

-- assigned_to: current holder's staff.id (changes as task flows down the chain)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_to   BIGINT REFERENCES staff(id) ON DELETE SET NULL;

-- assigned_role: role of the current holder ('manager'|'supervisor'|'staff')
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_role TEXT;

-- current_level: current position in the chain ('manager'|'supervisor'|'staff')
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS current_level TEXT DEFAULT 'staff';

-- ── SECTION 2: Constraint ─────────────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_current_level_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_current_level_check
  CHECK (current_level IN ('manager', 'supervisor', 'staff'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_role_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_role_check
  CHECK (assigned_role IN ('gm', 'manager', 'supervisor', 'staff') OR assigned_role IS NULL);

-- ── SECTION 3: Backfill existing tasks ───────────────────────
-- Existing tasks were all assigned to staff directly
UPDATE tasks
  SET
    current_level = 'staff',
    assigned_to   = assigned_staff_id,
    assigned_role = 'staff'
  WHERE current_level IS NULL OR current_level = 'staff';

-- ── SECTION 4: Indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
  ON tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_tasks_current_level
  ON tasks (current_level);

-- ── SECTION 5: Verify ─────────────────────────────────────────
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tasks'
--   AND column_name IN ('assigned_to', 'assigned_role', 'current_level');

-- ============================================================
-- END OF V4 MIGRATION
-- ============================================================
