import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL = 'https://fdkzorihlpdthyjunydg.supabase.co';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_lSnLb_itSETlhrUkndAQug_xCfRhAEC';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function restore() {
  console.log('Restoring departments and staff...');

  // 1. Create Staff (this should work since department IDs 1, 2, 3, 4 already exist)
  const staff = [
    { name: 'Ramesh (Housekeeping)', phone_number: '+917349732341', department_id: 1, role: 'staff' },
    { name: 'Mahesh (Supervisor)',    phone_number: '+917349732341', department_id: 1, role: 'supervisor' },
    { name: 'Suresh (Laundry)',       phone_number: '+917349732341', department_id: 2, role: 'staff' },
    { name: 'Ajay (Bell Desk)',       phone_number: '+917349732341', department_id: 3, role: 'staff' },
    { name: 'Imran (Maintenance)',    phone_number: '+917349732341', department_id: 4, role: 'staff' },
  ];

  const { data: createdStaff, error: staffError } = await supabase.from('staff').insert(staff).select();
  if (staffError) {
    console.error('Error creating staff:', staffError.message);
    return;
  }

  console.log('Staff created:', createdStaff.map(s => s.name));

  // 2. Set Default Staff for Departments
  const updates = [
    { deptId: 1, staffName: 'Ramesh (Housekeeping)' },
    { deptId: 2, staffName: 'Suresh (Laundry)' },
    { deptId: 3, staffName: 'Ajay (Bell Desk)' },
    { deptId: 4, staffName: 'Imran (Maintenance)' },
  ];

  for (const up of updates) {
    const s = createdStaff.find(x => x.name === up.staffName);
    if (s) {
      console.log(`Setting default staff for dept ${up.deptId} to ${up.staffName} (ID: ${s.id})`);
      const { error } = await supabase.from('departments').update({ default_staff_id: s.id }).eq('id', up.deptId);
      if (error) console.error(`Error updating dept ${up.deptId}:`, error.message);
    }
  }

  console.log('Done.');
}

restore();
