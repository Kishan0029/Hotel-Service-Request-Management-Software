-- ============================================================
-- SMS Logs Migration
-- Hotel Service Request Management System
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_logs (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    task_code   TEXT,                                     -- e.g. T142
    event_type  TEXT NOT NULL
                    CHECK (event_type IN ('sent', 'received', 'error')),
    status      TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'failed')),
    phone       TEXT,
    message     TEXT,
    raw_payload JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sms_logs IS
    'Audit log for all SMS events: sent to staff, replies received, and errors.';
COMMENT ON COLUMN sms_logs.task_code IS
    'Human-readable task code at time of event (e.g. T142).';
COMMENT ON COLUMN sms_logs.event_type IS
    'sent = outgoing SMS dispatched | received = incoming reply | error = failure';
COMMENT ON COLUMN sms_logs.status IS
    'sent = success | failed = MSG91 error or invalid phone';

CREATE INDEX IF NOT EXISTS idx_sms_logs_task_id
    ON sms_logs (task_id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at
    ON sms_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_event_type
    ON sms_logs (event_type);
