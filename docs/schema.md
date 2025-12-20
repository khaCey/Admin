# Data Schema

Canonical sheet schemas and keys. Keep this updated when columns change.

## Payment (sheet: `Payment`)
- Transaction ID
- Student ID
- Year (yyyy)
- Month (month name)
- Amount
- Discount
- Total
- Date
- Method
- Staff
Key: `Student ID` + `Year` + `Month` (canonical key `YYYY-MM`).

## Students (sheet: `Students`)
- ID
- Name
- 漢字
- Email
- Phone
- phone (secondary)
- 当日
- Status
- Payment
- Group
- 人数
- 子
Key: `ID`.

## Lessons summary (sheet: `Lessons`)
- Student ID
- Month (YYYY-MM)
- Lessons
Key: `Student ID` + `Month` (YYYY-MM).

## MonthlySchedule (events) (sheet: `MonthlySchedule`)
- EventID
- Title
- Start
- End
- Status
- StudentName
- IsKidsLesson
- TeacherName
Key: `EventID`. Student linkage currently by `StudentName` (string match).

## Notes (sheet: `Notes`)
- Student ID
- ID
- Staff
- Date
- Note
Key: `ID`; also scoped by `Student ID`.

## TeacherSchedules
- Date (yyyy-MM-dd)
- TeacherName
- StartTime (HH:mm)
- EndTime (HH:mm)
Key: Date + TeacherName + StartTime.

## TeacherCalendars
- CalendarID (Google Calendar ID)
- TeacherName
Used to import teacher availability into `TeacherSchedules`.

### Canonical month key
- `YYYY-MM` (e.g., `2025-11`), derived from Year + month number.
- Frontend stores Month as name; backend should normalize to `YYYY-MM` for joins.



