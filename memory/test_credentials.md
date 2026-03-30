# Test Credentials — Hotel Service Management System V2

## Important: Run V7 Migration First
Before testing, run `/app/database/v7_migration.sql` in your Supabase SQL Editor.
This adds: `email`, `password` columns to staff, `locations` table, `before_photo_url`, `after_photo_url` to tasks.

## Note: Supabase Project Must Be Active (Not Paused)
If queries time out, go to https://supabase.com/dashboard and resume the project.

## Login Credentials (after V7 migration is applied)
Default password for all accounts: `password123`

Emails are auto-generated as: `firstname.lastname@hotel.com`

### By Role
| Role       | Email Format                  | Password    |
|------------|-------------------------------|-------------|
| GM         | (name of your GM)@hotel.com   | password123 |
| Manager    | (name of manager)@hotel.com   | password123 |
| Reception  | (name of reception)@hotel.com | password123 |
| Staff      | (name of staff)@hotel.com     | password123 |
| Supervisor | (name of supervisor)@hotel.com| password123 |

## URLs
- Login:    https://65c59c82-a266-4eb3-b4a1-6c2bb3c366f0.preview.emergentagent.com/login
- GM:       https://65c59c82-a266-4eb3-b4a1-6c2bb3c366f0.preview.emergentagent.com/gm
- Manager:  https://65c59c82-a266-4eb3-b4a1-6c2bb3c366f0.preview.emergentagent.com/manager
- Staff:    https://65c59c82-a266-4eb3-b4a1-6c2bb3c366f0.preview.emergentagent.com/staff
- Reception:https://65c59c82-a266-4eb3-b4a1-6c2bb3c366f0.preview.emergentagent.com/

## API Keys
INTERNAL_API_KEY: supersecret123
NEXT_PUBLIC_API_KEY: supersecret123

## Supabase
URL: https://fdkzorihlpdthyjunydg.supabase.co
Anon Key: sb_publishable_lSnLb_itSETlhrUkndAQug_xCfRhAEC
