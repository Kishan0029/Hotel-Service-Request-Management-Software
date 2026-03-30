# Prompt for emergent.sh

**Please copy and paste the entire prompt below into emergent.sh:**

---

**Project Context:**
I need a comprehensive "Hotel Operations Management System" web application. The core focus is on role-based authentication, task routing based on locations, and capturing photographic evidence for issue resolution (before/after photos).

**Recommended Tech Stack:**
Use Next.js (App Router), React, and Tailwind CSS for the frontend. For the backend, authentication, database, and photo storage, use Supabase (or a similar complete BaaS). Use lucide-react for icons.

**Core Requirements & Features:**

**1. Authentication & Role-Based Routing:**
- Create a beautiful, modern Login Page requiring an Email and Password.
- Upon successful login, the system MUST retrieve the user's role from the database.
- Automatically redirect the user to their specific dashboard based on their role: `Reception`, `GM`, `Manager`, or `Staff`.
- E.g., The Reception person enters credentials -> Reception dashboard opens; GM enters details -> GM dashboard opens.

**2. Role-Specific Dashboards:**
- **Reception Dashboard:** Can view current hotel status, log generic guest requests, and see basic ticket statuses.
- **GM (General Manager) Dashboard:** Has a high-level overview of hotel operations. Must have a specific interface to **Assign Tasks directly to Managers**. Can view all tasks' progress.
- **Staff Dashboard:** Extremely simple, mobile-optimized view. Shows ONLY the tasks currently assigned to them.

**3. Manager Dashboard & "MOD Mode" (Manager On Duty):**
- The Manager dashboard shows tasks assigned to them by the GM.
- It MUST have a prominent, distinct button labeled **"MOD Mode"** (Manager on Duty Mode).
- Clicking "MOD Mode" opens a specialized interface for reporting real-time issues while walking around the hotel property:
  - **Inputs:** Dropdowns to select `Location` (e.g., Lobby, Pool, Room 101) and `Task Type` (Cleaning or Maintenance). The locations and tasks should be pre-populated from the database (or mock data for now).
  - **Photo Evidence (Before):** Implement a file upload / camera capture component so the Manager can click and add a photo of the location (before condition) before anything is done.
  - **Automated Dispatch:** When submitted, the system must automatically determine the "Concerned Person" (Staff member) responsible for that specific Location and Department (Cleaning/Maintenance). It assigns the task to them and sends them a notification (or simulated alert) to do the work.

**4. Staff Task Execution & Verification:**
- When the assigned "Concerned Person" gets the notification, they open their Staff Dashboard and see the task.
- They can review the Location, Task Type, and view the **"Before" photo** taken by the MOD.
- Once they finish the job, they must click a button to **Add a photo of the location after the work is done** ("After" photo).
- Uploading the "After" photo automatically marks the task as "Completed". The MOD and GM can now view both the Before and After photos side-by-side to verify the work.

**5. Database Schema Guidance (Please structure the models/tables like this):**
- `Users`: id, email, name, role (GM | Manager | Reception | Staff), department (Cleaning | Maintenance | Admin), assigned_location.
- `Locations`: id, name.
- `Tasks`: id, title, description, created_by (MOD id), assigned_to (Staff id), location_id, department, status (Pending | Completed), before_photo_url, after_photo_url, created_at, completed_at.

**Design & UX Constraints:**
- The interface must feel premium and enterprise-ready. Use a clean, modern color scheme with subtle glassmorphism if applicable.
- **Mobile-First Approach:** The Staff Dashboard and the Manager's "MOD Mode" MUST be highly responsive and optimized for mobile devices, as they will be used on phones while walking the property.
- Handle state gracefully (loading spinners during photo uploads, success toasts after assigning a task).
- Please provide a fully functional prototype out of the box. Use mock data for locations and users if creating an actual backend connection requires manual setup.
