-- ============================================================
-- V2 Migration — Hotel Service Request Management System
-- Run this in Supabase SQL Editor BEFORE deploying V2 code.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- ── Step 1: Drop old status CHECK constraint ─────────────────
-- The old constraint only allows 'pending' | 'completed'.
-- We need to replace it to include the new intermediate statuses.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

-- ── Step 2: Add new status CHECK constraint ──────────────────
-- New lifecycle: pending → acknowledged → in_progress → completed

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'completed'));

-- ── Step 3: Add type column ───────────────────────────────────
-- Distinguishes guest service requests from complaints.
-- Complaints receive a red highlight and stronger visual urgency.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS type TEXT
  CHECK (type IN ('request', 'complaint'))
  DEFAULT 'request';

-- ── Step 4: Backfill existing rows ───────────────────────────
-- Set all existing tasks to 'request' type (they had no type before).

UPDATE tasks
  SET type = 'request'
  WHERE type IS NULL;

-- ── Step 5: Add index on type for fast complaint filtering ────

CREATE INDEX IF NOT EXISTS idx_tasks_type
  ON tasks (type);

-- ── Step 6: Verify ────────────────────────────────────────────
-- Run this SELECT to confirm the migration succeeded:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tasks'
-- AND column_name IN ('status', 'type');

-- ============================================================
-- END OF V2 MIGRATION
-- ============================================================
