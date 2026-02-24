# Legacy app: 未納 (Unpaid) – where it is and what happens

## Where 未納 appears

- **Location**: In the **top navbar** (green bar), right side, next to:
  - **Add Student**
  - **未納** (this button)
  - **未定**
  - **Today's Lessons**
  - Notifications (bell)
- **Look**: White border, white text, alert-circle icon + label “未納”. On hover: white background, green text.
- **Visibility**: Controlled by feature flag `unpaidStudents.enabled` in `Code.js` (default `true`). If disabled, the button is hidden.

## What happens when you press 未納

1. **Modal opens**  
   The “Unpaid Students” modal (`#newFeatureModal`) is shown (full-screen overlay, centered white card).

2. **Initial load**  
   - The script calls `loadAvailableMonths()`, which runs `google.script.run.getAvailableMonths()` and fills the **Month** dropdown (current month first, then other months from the backend).  
   - In the success handler of `getAvailableMonths()`, it then calls **`loadUnpaidStudents()`**.

3. **What the modal shows**  
   - **Header**: “Unpaid Students” (title), “Students with Outstanding Payments” (subtitle). Optional “Month: [dropdown]” and **Refresh** button.  
   - **Table**: Two columns – **Student Name** and **Student ID**.  
   - **Data source**: **`getUnpaidStudentsForDisplay()`** (in `Code.js`).  
     - This reads the **Unpaid** sheet only (no month filter).  
     - Column A = student name.  
     - Student ID is **resolved by name** from the **Students** sheet (not from a column in Unpaid).  
     - Each row is one Unpaid sheet row: `{ name, id }` where `id` is from Students name lookup, or `null` if not found.

4. **If a name is not in Students**  
   The ID cell shows a red “Not found” (and the row is not clickable).

5. **If you click a row**  
   When the row has a resolved ID, clicking the row or the ID link calls **`openStudentDetails(id)`** and opens that student’s detail view (same as clicking a student in the main list).

6. **Month dropdown and Refresh**  
   - Changing the **Month** dropdown calls `loadUnpaidStudents()` again (same data: still the full Unpaid sheet).  
   - **Refresh** also calls `loadUnpaidStudents()`.  
   So the list content is always “all rows in the Unpaid sheet”; the month selector does not filter the backend data in the current implementation.

7. **Closing the modal**  
   **Close** (header) or **Close** (footer) hides the modal.

## Summary

| What | Where / How |
|------|------------------|
| **Button** | Navbar, “未納” with alert-circle icon. |
| **On click** | Opens Unpaid Students modal → loadAvailableMonths() → then loadUnpaidStudents(). |
| **Data** | **Unpaid sheet** only, via `getUnpaidStudentsForDisplay()`. Not computed from “events this month vs payments”. |
| **Columns** | Student Name (from Unpaid col A), Student ID (resolved from Students by name). |
| **Click row** | Opens student details for that ID (`openStudentDetails(id)`). |

So in the legacy app, 未納 is a **list of everyone on the Unpaid sheet**, with IDs resolved by name; pressing the button only opens this list and lets you jump to a student’s details. The new React app’s “未納 (Unpaid)” page uses the `unpaid` table (from Unpaid.csv) the same way: list of unpaid entries with student details, no month-based computation.
