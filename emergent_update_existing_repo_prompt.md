# Prompt for emergent.sh (With Attached Repository)

**Please copy and paste the entire prompt below into emergent.sh after attaching your V2 folder/repo:**

---

**Project Context:**
I have attached the existing codebase for my Next.js "Hotel Service Request Management System" (V2). The application currently has a basic structure and is connected to a Supabase backend. 

**Efficiency & Credit Usage (CRITICAL):**
Please be extremely efficient with your code generation to minimize credit usage. Do NOT rewrite entire files unless absolutely necessary. Only apply the precise, minimal edits required to implement the requested features and UI upgrades. Avoid creating unnecessary abstractions or over-engineering.

**Your Goal:**
Please **analyze my existing codebase**, particularly how I am querying my database and structuring my frontend. Carefully refactor and append the following new features into my existing architecture:

**1. Premium UI & Color Scheme Upgrade:**
- Upgrade the entire user interface to look highly premium, modern, and enterprise-ready. 
- Use a cohesive, high-end color palette (e.g., slate, navy, and white with subtle premium accents like muted gold or deep blue).
- Add subtle glassmorphism effects where appropriate.
- Implement smooth transitions, hover effects, and micro-animations to make the dashboard feel dynamic and alive.
- Ensure all forms, buttons, and tables look polished and consistent.

**2. Refactor Authentication & Role-Based Routing:**
- Please review my existing database schema and Auth structure.
- Update the Login Page so that users only need to provide their Email and Password.
- Upon successful authentication, automatically retrieve their role and route them to their respective role-specific dashboard.
- Roles to handle: General Manager (`GM`), `Manager`, `Reception`, and `Staff` (Cleaning/Maintenance).

**3. Implement Role-Specific Dashboards:**
- **Reception:** Should see the general ticket creation and basic hotel request status page.
- **GM (General Manager):** Needs a high-level overview. Please build an interface on the GM dashboard specifically allowing them to **Assign Tasks to Managers**.
- **Staff (Concerned Person):** Needs a simplified, mobile-first view showing ONLY the tasks assigned to them.
- *Ensure you reuse my existing UI components where possible and apply the new premium styling to them.*

**4. Build "MOD Mode" (Manager On Duty) into the Manager Dashboard:**
- Managers should see tasks assigned by the GM. Add a prominent, beautifully styled **"MOD Mode"** button on their dashboard.
- Clicking "MOD Mode" should open a new flow for reporting real-time issues:
  - Add dropdowns to select the `Location` and `Task Type` (Cleaning/Maintenance). Fetch these options from the database.
  - Implement a **"Before" Photo Upload**: Allow Managers to upload or capture photographic evidence of the issue. Use my existing Supabase storage setup (or create a new bucket if necessary).
  - **Automated Dispatch:** When submitted, the system must create the task, determine the exact "Concerned Person" responsible for that location and department, assign the task to them, and trigger a notification.

**5. Staff Task Verification (The "After" Photo):**
- Update the Staff Dashboard so that when a staff member opens an assigned task, they can see the MOD's "Before" photo.
- Add a button for the staff to **Upload an "After" photo** once the job is completed.
- Upon uploading the "After" photo, the task status should automatically update to "Completed". Ensure the GM and MOD can view both the Before and After photos for quality assurance.

**6. Database Updates (Keep Minimal):**
- Please review my `schema.sql`.
- Write and execute (or provide) only the strictly necessary SQL migration commands to support:
  - Role, department, and assigned location fields on the `Users` table.
  - A `Locations` table (if it doesn't exist).
  - `before_photo_url` and `after_photo_url` columns on the `Tasks` table.

**Rules for Modifying the Codebase:**
- Maintain my current styling logic (Tailwind CSS) but elevate the aesthetics as requested.
- Make sure the Staff Dashboard and MOD Mode are fully responsive and optimized for mobile devices.
