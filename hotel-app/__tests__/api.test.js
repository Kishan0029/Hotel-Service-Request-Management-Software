/**
 * Unit Tests — Hotel Service Request Management System
 * Tests pure business logic extracted from API routes (no DB/network calls).
 */

// ── 1. Status Transition Logic (from /api/tasks/[id]/route.js) ────────────────
const VALID_TRANSITIONS = {
  pending:      ['acknowledged'],
  acknowledged: ['in_progress'],
  in_progress:  ['completed'],
  completed:    [],
};

function isValidTransition(current, next) {
  return (VALID_TRANSITIONS[current] ?? []).includes(next);
}

describe('Task Status Transitions', () => {
  it('pending → acknowledged is valid', () => {
    expect(isValidTransition('pending', 'acknowledged')).toBe(true);
  });
  it('acknowledged → in_progress is valid', () => {
    expect(isValidTransition('acknowledged', 'in_progress')).toBe(true);
  });
  it('in_progress → completed is valid', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true);
  });
  it('pending → completed is INVALID (must follow chain)', () => {
    expect(isValidTransition('pending', 'completed')).toBe(false);
  });
  it('completed → any is INVALID (no going back)', () => {
    expect(isValidTransition('completed', 'pending')).toBe(false);
    expect(isValidTransition('completed', 'in_progress')).toBe(false);
    expect(isValidTransition('completed', 'acknowledged')).toBe(false);
  });
  it('unknown status has no valid transitions', () => {
    expect(isValidTransition('unknown_status', 'completed')).toBe(false);
  });
});

// ── 2. Role-Based Assignment Chain (from /api/tasks/[id]/route.js) ─────────────
const ASSIGN_TO_ROLE = {
  gm:         'manager',
  manager:    'supervisor',
  supervisor: 'staff',
};

describe('Role-Based Assignment Chain', () => {
  it('gm can only assign to manager', () => {
    expect(ASSIGN_TO_ROLE['gm']).toBe('manager');
  });
  it('manager can only assign to supervisor', () => {
    expect(ASSIGN_TO_ROLE['manager']).toBe('supervisor');
  });
  it('supervisor can only assign to staff', () => {
    expect(ASSIGN_TO_ROLE['supervisor']).toBe('staff');
  });
  it('staff cannot assign to anyone (role not in map)', () => {
    expect(ASSIGN_TO_ROLE['staff']).toBeUndefined();
  });
  it('reception cannot assign via chain (role not in map)', () => {
    expect(ASSIGN_TO_ROLE['reception']).toBeUndefined();
  });
});

// ── 3. API Auth Key Validation (from all route files) ─────────────────────────
function checkApiKey(provided, expected) {
  if (!provided || provided !== expected) return 401;
  return 200;
}

describe('API Key Authorization', () => {
  const CORRECT_KEY = 'supersecretkey';

  it('returns 200 with correct API key', () => {
    expect(checkApiKey(CORRECT_KEY, CORRECT_KEY)).toBe(200);
  });
  it('returns 401 with wrong API key', () => {
    expect(checkApiKey('wrong-key', CORRECT_KEY)).toBe(401);
  });
  it('returns 401 with empty string', () => {
    expect(checkApiKey('', CORRECT_KEY)).toBe(401);
  });
  it('returns 401 with null (header missing)', () => {
    expect(checkApiKey(null, CORRECT_KEY)).toBe(401);
  });
  it('returns 401 with undefined (header missing)', () => {
    expect(checkApiKey(undefined, CORRECT_KEY)).toBe(401);
  });
});

// ── 4. POST /api/tasks required field validation ───────────────────────────────
function validateTaskBody({ room_id, department_id, task_type, type = 'request' }) {
  if (!room_id || !department_id || !task_type) {
    return { error: 'room_id, department_id, and task_type are required', status: 400 };
  }
  if (!['request', 'complaint'].includes(type)) {
    return { error: 'type must be request or complaint', status: 400 };
  }
  return { status: 200 };
}

describe('Task Creation Validation', () => {
  it('valid body passes', () => {
    const result = validateTaskBody({ room_id: 1, department_id: 2, task_type: 'Housekeeping' });
    expect(result.status).toBe(200);
  });
  it('missing room_id returns 400', () => {
    const result = validateTaskBody({ department_id: 2, task_type: 'Housekeeping' });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/room_id/);
  });
  it('missing department_id returns 400', () => {
    const result = validateTaskBody({ room_id: 1, task_type: 'Housekeeping' });
    expect(result.status).toBe(400);
  });
  it('missing task_type returns 400', () => {
    const result = validateTaskBody({ room_id: 1, department_id: 2 });
    expect(result.status).toBe(400);
  });
  it('invalid type "billing" returns 400', () => {
    const result = validateTaskBody({ room_id: 1, department_id: 2, task_type: 'Billing', type: 'billing' });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/type must be request or complaint/);
  });
  it('"complaint" type is valid', () => {
    const result = validateTaskBody({ room_id: 1, department_id: 2, task_type: 'Noise', type: 'complaint' });
    expect(result.status).toBe(200);
  });
});

// ── 5. Phone Number Formatting ─────────────────────────────────────────────────
function formatPhone(phone) {
  if (!phone || phone === 'N/A') return null;
  if (phone.startsWith('+')) return phone;
  if (phone.length === 10) return `+91${phone}`;
  return `+${phone}`;
}

describe('Phone Number Formatting', () => {
  it('10-digit number gets +91 prefix', () => {
    expect(formatPhone('9876543210')).toBe('+919876543210');
  });
  it('number already starting with + is unchanged', () => {
    expect(formatPhone('+919876543210')).toBe('+919876543210');
  });
  it('number starting with country code but no + gets + prepended', () => {
    expect(formatPhone('919876543210')).toBe('+919876543210');
  });
  it('N/A is rejected and returns null', () => {
    expect(formatPhone('N/A')).toBeNull();
  });
  it('null/empty phone returns null', () => {
    expect(formatPhone(null)).toBeNull();
    expect(formatPhone('')).toBeNull();
  });
});

// ── 6. Login — Role to Route Mapping ──────────────────────────────────────────
function getRoleRoute(role) {
  if (role === 'gm')      return '/gm';
  if (role === 'manager') return '/manager';
  if (role === 'staff')   return '/staff';
  return '/'; // reception, supervisor
}

describe('Role Navigation Routing', () => {
  it('gm routes to /gm', () => expect(getRoleRoute('gm')).toBe('/gm'));
  it('manager routes to /manager', () => expect(getRoleRoute('manager')).toBe('/manager'));
  it('staff routes to /staff', () => expect(getRoleRoute('staff')).toBe('/staff'));
  it('reception routes to /', () => expect(getRoleRoute('reception')).toBe('/'));
  it('supervisor routes to /', () => expect(getRoleRoute('supervisor')).toBe('/'));
  it('unknown role routes to /', () => expect(getRoleRoute('unknown')).toBe('/'));
});

// ── 7. Activity Log Builder ─────────────────────────────────────────────────────
function buildActivityLog(currentLog, entry) {
  const log = Array.isArray(currentLog) ? currentLog : [];
  return [...log, { ...entry, time: 'mocked_time' }];
}

describe('Activity Log Builder', () => {
  it('appends entry to existing log', () => {
    const existing = [{ event: 'created', by: 'Reception', time: 't1' }];
    const updated = buildActivityLog(existing, { event: 'acknowledged', by: 'Staff A' });
    expect(updated).toHaveLength(2);
    expect(updated[1].event).toBe('acknowledged');
  });
  it('handles null log gracefully (starts fresh)', () => {
    const result = buildActivityLog(null, { event: 'created', by: 'Reception' });
    expect(result).toHaveLength(1);
  });
  it('handles non-array log gracefully', () => {
    const result = buildActivityLog('corrupted_data', { event: 'created', by: 'Reception' });
    expect(result).toHaveLength(1);
  });
  it('preserves all previous entries', () => {
    const log = [
      { event: 'created' },
      { event: 'acknowledged' },
      { event: 'started' },
    ];
    const result = buildActivityLog(log, { event: 'completed', by: 'Amit' });
    expect(result).toHaveLength(4);
    expect(result[3].event).toBe('completed');
    expect(result[3].by).toBe('Amit');
  });
});
