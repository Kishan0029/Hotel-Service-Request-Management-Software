-- ============================================================
-- V5 Migration — Reception Role
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Update role constraint to include 'reception'
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('staff', 'supervisor', 'manager', 'gm', 'reception'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_role_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_role_check
  CHECK (assigned_role IN ('gm', 'manager', 'supervisor', 'staff', 'reception') OR assigned_role IS NULL);

-- 2. Insert a default Reception user if none exists
INSERT INTO staff (name, phone_number, department_id, role, is_active)
SELECT
  'Front Desk Reception',
  'N/A',
  (SELECT id FROM departments ORDER BY id LIMIT 1),
  'reception',
  true
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE role = 'reception');
