# Offline Desktop Student Management System

## Project Requirements Document

------------------------------------------------------------------------

## 1. Overview

This project is a **desktop-based Student Management System** built
using **React** and packaged as a desktop application.\
The system will:

-   Run entirely offline (no internet required)
-   Operate on a single device
-   Store all data locally on the machine
-   Require no remote server or cloud database

------------------------------------------------------------------------

## 2. Core Architecture

### Frontend

-   React-based user interface
-   Desktop application shell (Electron or Tauri)
-   Fully offline functionality

### Backend (Local Only)

-   No external API calls
-   Local database stored on device
-   Data access through internal service layer

### Database

-   Local database hosted entirely on desktop
-   Recommended: SQLite
-   Alternative: JSON file-based storage (for very small systems)
-   Database file stored locally and accessible for backups

------------------------------------------------------------------------

## 3. Functional Requirements

### Student Management

-   Add new students
-   Edit student details
-   Delete student records
-   Search and filter students
-   View student history
-   Google Contacts sync (create, update, delete contacts)
-   Child/adult type indicator (子)
-   Status management (Active, Dormant, DEMO)
-   Payment type (NEO/OLD)
-   Group size (人数)

### Lesson Management

-   Schedule lessons
-   Record completed lessons
-   Edit or delete lesson entries
-   View lesson history per student
-   Calendar integration (create, read, update events)
-   Cancel, reschedule, remove lessons
-   LessonActions audit trail
-   Kids vs adults separation (no mixing in same time slot)
-   Teacher assignment to lessons

### Lesson Booking

-   Availability-based booking (teachers available, slots free)
-   Teacher filter (filter slots by selected teachers)
-   BookingAvailability cache (Date, Time, Reason)
-   TeacherSchedules sync from teacher calendars
-   Hourly maintenance (prune past availability, refresh cache)

### Today's Lessons

-   External `lessons_today` sheet integration
-   Student ID enrichment for lesson rows
-   Unpaid status display (orange/green)
-   Click handlers for lesson cards

### Payment Management

-   Record payments
-   Track unpaid balances
-   View payment history
-   Generate summaries
-   Add, edit, delete payments
-   Fee calculation by type (Single/Group, OLD/Neo, frequency 2x/4x/8x)
-   Transaction ID tracking
-   Update Lessons sheet payment flag to 済
-   Monthly payment status per student

### Unpaid Students

-   Unpaid sheet as source of truth
-   List with resolved student IDs
-   Modal display for unpaid students

### Notes System

-   Add notes per student
-   Edit and delete notes
-   Chronological note history
-   Staff tracking per note

### Dashboard

-   Stats cards (student count, payments, lessons)
-   Chart image
-   Lesson counts
-   Payment summaries

### Feature Flags

-   Toggle visibility of features: notifications, unpaidStudents, unscheduledLessons, codePage, lessonBooking, lessonActions

### Tooltip System

-   User-specific dismissals (per user ID)
-   Feature-flag-aware display
-   Hourly re-check for tooltip visibility

### Code/Admin Page

-   View and manage code/data (feature-flagged)

------------------------------------------------------------------------

## 3a. Current App Feature Inventory (Pre-Conversion)

Checklist for migration verification. All items must be implemented in the React app:

- [ ] Student CRUD (add, edit, delete, search, filter)
- [ ] Google Contacts sync (create/update/delete)
- [ ] Payment CRUD (add, edit, delete)
- [ ] Fee calculation (OLD/Neo, Single/Group, 2x/4x/8x)
- [ ] Notes CRUD
- [ ] Lesson booking (availability-based, teacher filter)
- [ ] Lesson actions (cancel, reschedule, remove)
- [ ] Today's Lessons (external sheet, unpaid status)
- [ ] Unpaid students list
- [ ] Dashboard (stats, chart, lesson counts)
- [ ] Feature flags
- [ ] Kids vs adults separation
- [ ] LessonActions audit trail
- [ ] BookingAvailability cache and maintenance

------------------------------------------------------------------------

## 4. Data Schema Requirements

The React app must map to an equivalent schema (e.g. SQLite). Current sheets:

| Sheet | Purpose | Key Columns |
|-------|---------|-------------|
| Students | Student master | ID, Name, 漢字, Email, Phone, 当日, Status, Payment, Group, 人数, 子 |
| Payment | Payment records | Transaction ID, Student ID, Year, Month, Amount, Discount, Total, Date, Method, Staff |
| Notes | Student notes | Student ID, ID, Staff, Date, Note |
| Lessons | Monthly lesson totals | Student ID, Month (YYYY-MM), Lessons |
| MonthlySchedule | Cached calendar events | EventID, Title, Date, Start, End, Status, StudentName, IsKidsLesson, TeacherName |
| Unpaid | Unpaid list | Student ID / Name (resolved to IDs) |
| TeacherSchedules | Teacher availability | Date, TeacherName, StartTime, EndTime |
| TeacherCalendars | Calendar to teacher mapping | CalendarID, TeacherName |
| BookingAvailability | Cached availability | Date, Time, Reason, etc. |
| LessonActions | Audit trail | studentId, eventId, actionType, oldDateTime, newDateTime, reason |
| Stats, Chart, ManualTally, Code, LessonsMonth | Supporting | (document minimally) |

**External data**: `lessons_today` sheet (separate spreadsheet ID) — used for Today's Lessons view.

**Canonical month key**: `YYYY-MM` (e.g. `2025-11`).

------------------------------------------------------------------------

## 5. External Integrations

| Integration | Purpose | React Conversion Note |
|-------------|---------|----------------------|
| Google Sheets | All persistent data | Replace with SQLite (or equivalent) |
| Google Calendar | Lesson events; teacher availability (SHAM calendar) | Decide: keep API or local-only |
| Google People API | Contact sync | Decide: keep or drop |
| lessons_today external sheet | Today's Lessons data | Decide: migrate to local DB or external API |

------------------------------------------------------------------------

## 6. Business Rules

- **Fee structure**: OLD vs Neo; Single vs Group; 2x/4x/8x frequency; Pronunciation; Owner's Lesson flat rate. See `feeTable` in Code.js.
- **Canonical month key**: `YYYY-MM`.
- **Kids vs adults**: No mixing in same time slot (`checkAgeGroupConflicts`).
- **Lesson status**: Only `scheduled` (or empty) counted for availability calculations.
- **当日**: Same-day cancellation handling.
- **Student–payment linkage**: Student ID + Year + Month for payment status.
- **Booking availability**: `availableSlots = teacherCount - lessonCount`; slot available if > 0.

------------------------------------------------------------------------

## 7. Feature Flags

Feature flags must remain configurable after conversion:

| Flag | Purpose |
|------|---------|
| notifications | Notification system |
| unpaidStudents | Unpaid students button |
| unscheduledLessons | Unscheduled lessons button |
| codePage | Code management page |
| lessonBooking | Lesson booking calendar |
| lessonActions | Cancel/Reschedule/Remove lesson actions |

------------------------------------------------------------------------

## 8. Data Storage Requirements

**Target (post-conversion):**

-   All data must be stored locally
-   No cloud syncing
-   Database file must persist between restarts
-   Support manual backup (copy database file)
-   Optional: automated daily backup feature

**Current (pre-conversion):** Data stored in Google Sheets across multiple spreadsheets.

------------------------------------------------------------------------

## 9. Startup Behaviour

**Target (post-conversion):**

-   Application launches as a desktop app
-   Local database initializes automatically
-   No internet checks required
-   Optional: ability to auto-start on OS boot

**Current (pre-conversion):** Web-based app served via Google Apps Script; no desktop launch.

------------------------------------------------------------------------

## 10. Security Considerations

-   Optional local login system (single-user or multi-user)
-   Data stored only on device
-   No external data transmission

------------------------------------------------------------------------

## 11. Performance Expectations

-   Smooth performance with:
    -   Hundreds to thousands of students
    -   Thousands of lesson and payment records
-   Fast local database queries
-   No network latency

**Current scale:** App handles hundreds of students and thousands of lessons; performance targets apply to both current and converted app.

------------------------------------------------------------------------

## 12. Backup & Maintenance

-   Database stored in predictable local folder
-   Easy manual backup by copying DB file
-   Optional export:
    -   CSV
    -   PDF
-   Versioned schema support for future updates

------------------------------------------------------------------------

## 13. Future Expansion (Optional)

-   Multi-user local accounts
-   Audit logs
-   Role-based permissions
-   Data export tools
-   LAN-based sharing (if needed later)

------------------------------------------------------------------------

## 14. Technical Stack Recommendation

-   React (UI)
-   Electron (Desktop Shell)
-   SQLite (Local Database)
-   Node.js (Internal Service Layer)

------------------------------------------------------------------------

## References

-   `docs/schema.md` — canonical schema
-   `docs/function-directory.md` — function catalog
-   `docs/lessons-today-mapping.md` — lessons_today flow
-   `Booking-Module-Algorithm.md` — booking logic
-   `PAYMENT-DATA-FLOW.md` — payment flow

------------------------------------------------------------------------

## Final Summary

This system is designed to function as a **fully offline, single-device
desktop student management system**,\
with all data hosted and stored locally, requiring no internet
connection or remote server infrastructure.

**Conversion context:** The current app is a Google Apps Script web app
using Google Sheets. This document captures both the target architecture
(React, Electron, SQLite) and the actual functional requirements from the
existing codebase to ensure nothing is lost during the React conversion.
