# Test Credentials — Hotel Service Management System V2

## STEP 1: Apply Database Migration (REQUIRED)
Run `/app/database/v7_migration.sql` in your **Supabase SQL Editor**.
This adds: `email`, `password` columns to staff; `locations` table; `before_photo_url`, `after_photo_url`, `is_mod_task`, `location_id` to tasks.

## STEP 2: Resume Supabase Project (IF PAUSED)
Free-tier projects auto-pause after 1 week of inactivity.
Go to https://supabase.com/dashboard → Resume Project.

## STEP 3: Create Supabase Storage Bucket (REQUIRED for Photos)
In Supabase Dashboard → Storage → New Bucket:
- Name: `task-photos`
- Public: YES
- File size limit: 50MB
- Add policy: Allow all reads (public), allow all inserts (anon key)

## Login Credentials (after V7 migration is applied)
Default password for ALL accounts: `password123`

Emails auto-generated from staff names:
`firstname.lastname@hotel.com` (e.g., john.doe@hotel.com)

### By Role
| Role       | Email Format                   | Password    |
|------------|--------------------------------|-------------|
| GM         | [gm-name]@hotel.com            | password123 |
| Manager    | [manager-name]@hotel.com       | password123 |
| Reception  | [reception-name]@hotel.com     | password123 |
| Staff      | [staff-name]@hotel.com         | password123 |
| Supervisor | [supervisor-name]@hotel.com    | password123 |

To see exact emails, run in Supabase SQL Editor:
`SELECT name, email, role FROM staff WHERE is_active = true ORDER BY role;`

## Preview URLs (Container)
- Login:    https://app-makeover-17.preview.emergentagent.com/login
- GM:       https://app-makeover-17.preview.emergentagent.com/gm
- Manager:  https://app-makeover-17.preview.emergentagent.com/manager
- Staff:    https://app-makeover-17.preview.emergentagent.com/staff
- Reception:https://app-makeover-17.preview.emergentagent.com/

## API Keys
INTERNAL_API_KEY: supersecret123
NEXT_PUBLIC_API_KEY: supersecret123

## Supabase
URL: https://fdkzorihlpdthyjunydg.supabase.co
Anon Key: sb_publishable_lSnLb_itSETlhrUkndAQug_xCfRhAEC

## Test Session Injection (for UI testing without DB)
Manager: `{"id":1,"name":"Test Manager","role":"manager","department_id":1,"department_name":"Housekeeping"}`
Staff: `{"id":5,"name":"John Cleaner","role":"staff","department_id":1}`
GM: `{"id":2,"name":"Test GM","role":"gm"}`
