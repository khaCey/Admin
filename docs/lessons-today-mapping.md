# lessons_today → Students Mapping

How data from the `lessons_today` sheet maps to students and drives the Today's Lessons cards (including orange/green unpaid status).

---

## 1. Data Flow

```
lessons_today sheet (external spreadsheet)
    ↓
Row 1 = headers (column names become object keys)
Row 2+ = data rows
    ↓
normalizeLessonRows() → each row becomes { Header1: value, Header2: value, ... }
    ↓
enrichLessonRowsWithStudentIds() → adds studentIds: [id1, id2, ...] to each row
    ↓
Client receives rows → uses studentIds for Unpaid check and click handlers
```

---

## 2. Column Names the Code Expects

**Row objects use the exact header text from the sheet.** The code checks multiple possible keys (case-sensitive); your sheet header must match one of them.

### For Student ID (preferred – used first if present)

| Header in sheet | Used as |
|-----------------|---------|
| `Student ID` | row['Student ID'] |
| `StudentID` | row.StudentID |
| `studentId` | row.studentId |

If any of these exist and are non-empty, that value is used directly. **No lookup.** Group lessons: use one ID per student; for multiple students you'd need `studentIds` (array) – see note below.

### For Student Name (fallback – when no ID column)

| Header in sheet | Used as |
|-----------------|---------|
| `StudentName` | row.StudentName |
| `StudentNames` | row.StudentNames |
| `studentName` | row.studentName |
| `studentNames` | row.studentNames |
| `Name` | row.Name |

First non-empty match wins. The value is then looked up in the **Students** sheet (`Name` column → `ID`).

### For Display (card content)

| Header in sheet | Used for |
|-----------------|----------|
| `Title` or `EventName` or `eventName` | Card title (e.g. "Kanako Imai (cafe) 1/2") |
| `StudentName` / `StudentNames` / etc. | Shown under title |
| `Start` or `EventStart` or `startTime` | Start time |
| `End` or `EventEnd` or `endTime` | End time |

---

## 3. Student ID Resolution (enrichLessonRowsWithStudentIds)

For each row:

1. **Already has studentIds?**  
   If `row.studentIds` is a non-empty array → skip, use as-is.

2. **Has Student ID column?**  
   If `row.studentId` or `row['Student ID']` or `row.StudentID` is non-empty → use that as `studentIds: [value]`.

3. **Otherwise resolve by name**  
   Get name from `StudentName` / `StudentNames` / `studentName` / `studentNames` / `Name`.  
   Call `resolveStudentIdsFromNames(nameStr)`:
   - Split by ` and `, `,`, `&` (group lessons)
   - For each name, look up in **Students** sheet: `Name` → `ID`
   - Return array of IDs found  
   - **Duplicate names:** last match overwrites (only one ID per name)

---

## 4. Students Sheet Lookup (resolveStudentIdsFromNames)

- Source: **Students** sheet in main spreadsheet
- Columns used: `Name`, `ID`
- Builds `nameToId[name] = id` (last row wins for duplicates)
- Returns `[id1, id2, ...]` for each name in the lesson

---

## 5. Recommended lessons_today Schema

To map correctly and avoid wrong IDs:

| Column | Purpose | Example |
|--------|---------|---------|
| `Student ID` | **Best.** Direct ID from Students sheet. Use this for correct orange/green. | `518` |
| `StudentName` | Fallback when no Student ID. Must match Students sheet `Name` exactly. | `Kanako Imai` |
| `Title` | Card title | `Kanako Imai (cafe) 1/2` |
| `Start` | Start time (Date or string) | `2026-02-09 13:00:00` |
| `End` | End time | `2026-02-09 13:50:00` |

**For group lessons:** `StudentName` = `"Student A and Student B"` (or `,` or `&`). Each name is looked up separately.

---

## 6. Unpaid Check (client)

- `getUnpaidStudentIds()` returns IDs from the **Unpaid** sheet (column B).
- For each card: `anyOnUnpaidList = effectiveIds.some(id => unpaidSet.has(id))`
- Orange = any card student ID is in Unpaid list  
- Green = none of the card's IDs are in Unpaid list

---

## 7. Common Issues

| Problem | Likely cause |
|---------|--------------|
| Wrong student (e.g. Kanako shows orange but she's not unpaid) | `Student ID` column has wrong value, or name resolves to wrong ID (duplicate names). |
| Card shows no color | `studentIds` is empty (no ID column, and name not found in Students). |
| Group lesson wrong | `StudentName` format not `"A and B"` or `studentIds` doesn't include all students. |

**Fix:** Ensure `lessons_today` has a correct `Student ID` column that matches the **Students** sheet `ID` for each lesson.
