-- ============================================================
-- V6 Migration — Shift Tracking (On Duty Control)
-- Run in Supabase SQL Editor
-- ============================================================

-- Add on_duty column to track active shifts vs inactive time off
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS on_duty BOOLEAN DEFAULT true;
