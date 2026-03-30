-- Seed Data for Hotel Service Management System
-- Run in Supabase SQL Editor

-- Departments
INSERT INTO departments (name) VALUES
  ('Housekeeping'),
  ('Maintenance'),
  ('Front Office')
ON CONFLICT DO NOTHING;

-- Rooms
INSERT INTO rooms (room_number, floor) VALUES
  (101, 1),(102, 1),(103, 1),
  (201, 2),(202, 2),(203, 2),
  (301, 3),(302, 3)
ON CONFLICT DO NOTHING;

-- Staff (one per role for testing)
INSERT INTO staff (name, role, department_id, phone_number, is_active, email, password)
VALUES
  ('Admin GM',       'gm',         NULL, '+1000000001', true, 'admin.gm@hotel.com',       'password123'),
  ('Mike Manager',   'manager',    1,    '+1000000002', true, 'mike.manager@hotel.com',   'password123'),
  ('Sara Reception', 'reception',  3,    '+1000000003', true, 'sara.reception@hotel.com', 'password123'),
  ('Tom Super',      'supervisor', 1,    '+1000000004', true, 'tom.super@hotel.com',      'password123'),
  ('Ali Cleaner',    'staff',      1,    '+1000000005', true, 'ali.cleaner@hotel.com',    'password123'),
  ('Ben Fixer',      'staff',      2,    '+1000000006', true, 'ben.fixer@hotel.com',      'password123')
ON CONFLICT DO NOTHING;
