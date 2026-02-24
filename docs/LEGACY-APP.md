# Legacy App (Google Apps Script)

The legacy app is a **Google Apps Script** project that uses **Google Sheets** as the database. It consists of:

- **Code.js** – Server-side logic (data access, calendar sync, payment/lesson logic).
- **Index.html** – Web app UI (student list, details, payment modal, booking modal).
- **Sheets** – Students, Payment, Lessons, MonthlySchedule, Notes, Stats, Unpaid, etc.

## How it works

1. **Data storage**: All data lives in sheets. Each sheet has a header row and rows of data. There is no student ID in the MonthlySchedule sheet; linkage to students is by **student name** (`StudentName` column).

2. **MonthlySchedule sheet**: This is a **cache** of calendar events (from Google Calendar). It is filled by:
   - `cacheEventsToSheet(monthStr, 'MonthlySchedule')` – fetches events for a month and writes EventID, Title, Date, Start, End, Status, StudentName, IsKidsLesson, TeacherName.
   - The backend uses this sheet to show “Lessons this month”, count lessons per student, and drive unpaid/unscheduled logic.

3. **Student lookup**: The legacy app resolves students by **name**, not ID, in the schedule:
   - `resolveStudentIdsFromNames(namesStr)` in Code.js looks up the Students sheet by `Name` to get `ID`.
   - MonthlySchedule rows only have `StudentName`; when the app needs to show unpaid status or open a student, it matches `StudentName` to the Students sheet.

4. **Key flows**:
   - **Unpaid**: Events this month from MonthlySchedule vs payments in Payment sheet (by Student ID + Year + Month).
   - **Lessons this month**: Read from MonthlySchedule for the selected month; filter by student name for detail view.
   - **Booking**: Legacy booking modal uses MonthlySchedule and TeacherSchedules; new events are written back to the cache/sheet.

5. **Deployment**: The project is deployed with **clasp**; after code changes you run `clasp push`. See `docs/function-directory.md` and `docs/schema.md` for function list and sheet schemas.

## New app (React + PostgreSQL)

The **react-app** replaces sheets with PostgreSQL. The `monthly_schedule` table mirrors the legacy **MonthlySchedule** sheet (same columns conceptually; no `student_id` – only `student_name`). Migration imports from `MonthlySchedule.csv` into `monthly_schedule`. To find schedule rows for a given **student ID**, you look up the student’s **name** in `students`, then query `monthly_schedule` by `student_name`.
