# PRD — Hotel Service Request Management System V2

## Original Problem Statement
Next.js Hotel Service Request Management System upgrade including:
- Premium UI & Color Scheme Upgrade (navy/slate/gold glassmorphism)
- Refactored Authentication (email + password instead of staff picker)
- Role-specific dashboards (GM, Manager, Reception, Staff)
- MOD Mode (Manager On Duty) for real-time issue reporting with photo upload
- Staff Task Verification ("After" photo upload for task completion)
- Database Updates (locations, photo URL columns)

## Architecture
- **Frontend**: Next.js 14 (App Router)
- **Backend**: Supabase (PostgreSQL + Storage)
- **SMS**: Twilio
- **Auth**: Custom email+password (stored in staff table)
- **Storage**: Supabase Storage bucket `task-photos`
- **Port**: 3000 (Next.js dev server)

## User Personas
- **GM**: Property-wide overview, assign tasks to managers
- **Manager**: Department tasks, MOD Mode for real-time issue reporting
- **Reception**: Create tickets, view status
- **Staff**: Mobile-first task view, upload After photos
- **Supervisor**: Same as reception (legacy role)

## Core Requirements (Static)
1. Email/password login → auto-route by role
2. Roles: GM, Manager, Reception, Staff, Supervisor
3. MOD Mode: location dropdown, task category, before photo upload, auto-dispatch to staff + SMS
4. Staff After Photo upload → auto-complete task
5. GM/Manager can view Before + After photos
6. Premium UI: navy/slate/white with gold accents, glassmorphism

## What's Been Implemented (as of 2026-02)

### Database
- [x] V7 migration SQL (`/app/database/v7_migration.sql`)
  - `email`, `password` columns on `staff` table
  - `locations` table (rooms + hotel areas)
  - `before_photo_url`, `after_photo_url`, `is_mod_task`, `location_id` on `tasks`

### API Routes (updated/new)
- [x] `POST /api/login` — email/password authentication
- [x] `GET /api/locations` — fetch hotel locations
- [x] `POST /api/tasks/[id]/photo` — upload Before/After photo to Supabase Storage
- [x] `POST /api/tasks` — MOD dispatch support (`mod_dispatch: true` param)
- [x] Updated TASK_SELECT in all routes to include V7 columns

### Frontend Pages
- [x] `/login` — Premium glass card with email/password form
- [x] `/` (Reception) — Updated routing (manager → /manager, staff → /staff)
- [x] `/gm` — GM Dashboard (existing, premium styled)
- [x] `/manager` — New Manager Dashboard with MOD Mode
- [x] `/staff` — New Staff Dashboard (mobile-first, Before/After photos)

### UI/UX
- [x] Full globals.css rewrite — navy/slate/gold design system
- [x] Premium glassmorphism login card
- [x] MOD Mode prominent button with pulse animation
- [x] Staff task cards with status color stripes
- [x] Before/After photo comparison view
- [x] In-app notification banner for new tasks
- [x] Role-aware Sidebar component
- [x] Responsive: mobile-first for Staff dashboard

## Prioritized Backlog

### P0 (Blocking)
- [ ] Run V7 migration SQL in Supabase dashboard
- [ ] Create `task-photos` bucket in Supabase Storage (set to public)
- [ ] Resume Supabase project if paused (free tier auto-pauses)

### P1 (High Priority)
- [ ] GM Dashboard: Add task assignment to managers panel (existing /gm page)
- [ ] Real-time WebSocket notifications for Staff dashboard (currently polling every 15s)
- [ ] Admin pages (staff/departments/rooms) premium styling
- [ ] Staff email/password management UI (change password)

### P2 (Nice to Have)
- [ ] Supervisor dashboard (currently uses reception flow)
- [ ] Location-to-staff mapping (dedicated staff per location/area)
- [ ] Task analytics/reporting for GM

## Next Tasks
1. Apply V7 migration in Supabase dashboard
2. Create `task-photos` Supabase Storage bucket (public read + authenticated write policies)
3. Test end-to-end login flow for each role
4. Test MOD Mode photo upload flow
5. Test Staff "After Photo" → auto-complete flow
6. Apply premium styling to existing GM dashboard

## Env Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key
- `INTERNAL_API_KEY` — API security key (server-side)
- `NEXT_PUBLIC_API_KEY` — API key for client-side requests
- `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER` — SMS
