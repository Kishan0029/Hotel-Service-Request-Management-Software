-- ============================================================
-- V3 Migration — Hotel Service Request Management System
-- Run in Supabase SQL Editor AFTER v2_migration.sql.
-- All statements are idempotent (safe to re-run).
-- ============================================================


-- ── SECTION 1: Staff role — add 'gm' ─────────────────────────
-- Allow a GM login entry in the staff table.
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('staff', 'supervisor', 'manager', 'gm'));

-- Insert a GM staff member (idempotent — only if none exists)
INSERT INTO staff (name, phone_number, department_id, role, is_active)
SELECT
  'General Manager',
  'N/A',
  (SELECT id FROM departments ORDER BY id LIMIT 1),
  'gm',
  true
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE role = 'gm');


-- ── SECTION 2: Department SLA defaults ───────────────────────
-- Add sla_minutes column to departments table.
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS sla_minutes INTEGER DEFAULT 10;

-- Seed per-department SLA values
UPDATE departments SET sla_minutes = 10  WHERE name = 'Housekeeping';
UPDATE departments SET sla_minutes = 5   WHERE name = 'Maintenance';
UPDATE departments SET sla_minutes = 15  WHERE name = 'Laundry';
UPDATE departments SET sla_minutes = 10  WHERE name = 'Bell Desk';
-- Default (10) applies to any other department


-- ── SECTION 3: Task columns ───────────────────────────────────

-- expected_time: SLA target in minutes, copied from dept at creation
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS expected_time INTEGER DEFAULT 10;

-- unassigned: true when no active staff could be auto-assigned
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS unassigned BOOLEAN DEFAULT FALSE;

-- activity_log: JSON audit trail of status changes, reassignments, etc.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]';


-- ── SECTION 4: Backfill existing tasks ───────────────────────
-- Set expected_time from their department's sla_minutes
UPDATE tasks t
  SET expected_time = d.sla_minutes
  FROM departments d
  WHERE t.department_id = d.id
    AND t.expected_time = 10;   -- only update rows still at default

-- Seed a "created" activity log entry for all existing tasks that have none
UPDATE tasks
  SET activity_log = jsonb_build_array(
    jsonb_build_object(
      'event', 'created',
      'by', 'System',
      'time', to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  )
  WHERE activity_log = '[]'::jsonb OR activity_log IS NULL;


-- ── SECTION 5: Indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_unassigned
  ON tasks (unassigned)
  WHERE unassigned = true;

CREATE INDEX IF NOT EXISTS idx_departments_sla
  ON departments (sla_minutes);


-- ── SECTION 6: Verify ─────────────────────────────────────────
-- Optional: run to confirm migration
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tasks'
--   AND column_name IN ('expected_time', 'unassigned', 'activity_log');

-- SELECT id, name, sla_minutes FROM departments ORDER BY name;
-- SELECT id, name, role FROM staff WHERE role = 'gm';

-- ============================================================
-- END OF V3 MIGRATION
-- ============================================================
