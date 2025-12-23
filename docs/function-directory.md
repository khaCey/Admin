# Function Directory

Curated list of major functions with purpose and location. Keep this file updated when adding/changing functions.

| Function | File | Purpose |
| --- | --- | --- |
| `getStudents()` | Code.js | Returns all students from the Students sheet. |
| `getStudentDetails(id)` | Code.js | Returns a student’s profile, payments, notes, and latestByMonth. |
| `getLatestRecordData(studentName)` | Code.js | Builds latestByMonth map (payment status + lessons/unscheduled). |
| `getUnpaidStudentsThisMonth(selectedMonth?, selectedYear?)` | Code.js | Lists students with events this month but no matching payment in Payment. |
| `getPaymentInfoForMonth(studentName, monthText, studentId?)` | Code.js | Checks Payment sheet for payment rows by Student ID + Year + Month; returns status/lessons/amount. |
| `insertPayment(pay)` | Code.js | Appends a payment row, updates lessons payment flag to '済', adjusts student status. |
| `updatePayment(pay)` | Code.js | Updates an existing payment row matched by Transaction ID. |
| `getAvailableMonths(studentID, yearStr)` | Code.js | Lists month values for a student from the Lessons sheet. |
| `saveMonthlyRecord(record)` | Code.js | Upserts a Lessons/MonthlySchedule record and writes payment/schedule fields. |
| `getStudentLessonTotal(studentId, monthText)` | Code.js | Returns total lessons for a student in a month based on payment info. |
| `calculatePrice(lessonsCount)` | Index.html | Client-side fee calculation used in payment modal. |
| `openPaymentModal(opts)` | Index.html | Manages add/edit payment modal; sends payload to backend. |
| `openBookLessonModal(opts)` | Index.html | Legacy booking calendar modal setup and rendering. |
| `createLatestRecord({...})` | Index.html | Renders latestByMonth (paid/unpaid + lessons cards) in student details. |
| `loadUnpaidStudents()` | Index.html | Fetches unpaid students via `getUnpaidStudentsThisMonth` and renders modal. |
| `syncTeacherSchedulesFromCalendars()` | Code.js | Pulls teacher calendar events (from Code sheet) into TeacherSchedules for current + next month. |
| `prunePastAvailability()` | Code.js | Deletes past rows from BookingAvailability where Date+Time is earlier than now. |
| `hourlyAvailabilityMaintenance()` | Code.js | Runs prunePastAvailability then refreshBookingAvailabilityCache; intended for hourly trigger. |
| `calculateAndStoreWeekAvailability(weekStart, forceRecalculate)` | Code.js | Builds BookingAvailability rows (with Reason: no-teachers/fully-booked when slots=0). |

Notes:
- Month handling: backend uses separate Month (name) + Year columns; canonical key is `YYYY-MM`.
- Update this table when adding/modifying functions or changing key inputs/outputs.

Maintenance workflow:
- When adding/updating functions, update this file and `docs/schema.md` if data shape changes.
- After code changes (non-doc-only), run `clasp push` to deploy.

