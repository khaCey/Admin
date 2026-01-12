# Booking Calendar Algorithm Review

## Date: Current Review

## Algorithm Correctness Analysis

### ✅ CORRECT Components

1. **Teacher Deduplication** (FIXED)
   - ✅ Now uses `availableTeachersSet` object to track unique teachers
   - ✅ Prevents counting same teacher multiple times if they have overlapping shifts
   - **Location**: Lines 3507-3533

2. **Available Slots Calculation**
   - ✅ Formula: `availableSlots = Math.max(0, teacherCount - lessonCount)`
   - ✅ Correctly calculates remaining capacity
   - **Location**: Line 3550

3. **Teacher Availability Check**
   - ✅ Checks: `lessonStart >= shiftStart && lessonEnd <= shiftEnd`
   - ✅ Correctly validates if 50-minute lesson fits within teacher's shift
   - **Location**: Line 3523

4. **Status Filtering**
   - ✅ Only counts lessons with Status = 'scheduled'
   - ✅ Excludes cancelled, rescheduled, reserved lessons
   - **Location**: Line 3471

5. **NextMonthSchedule Integration** (FIXED)
   - ✅ Reads from both MonthlySchedule and NextMonthSchedule
   - ✅ Handles weeks spanning month boundaries
   - **Location**: Lines 3414-3418

### ⚠️ POTENTIAL ISSUES

#### Issue 1: Exact Time Matching (CRITICAL)
**Problem**: Lessons are matched to time slots by exact time string match.

**Current Logic**:
- Lessons stored with: `rowTimeStr = Utilities.formatDate(startDate, tz, 'HH:mm')` → e.g., "10:05"
- Time slots checked: "10:00", "11:00", "12:00", etc.
- Match: `existingLessonsMap[dateStr][timeStr]` → exact string match

**Impact**:
- If a lesson starts at 10:05, it's stored as "10:05"
- When checking availability for 10:00 slot, it looks for `existingLessonsMap["2024-01-15"]["10:00"]`
- The lesson at "10:05" won't be found, so it won't be counted
- **Result**: Availability will be incorrectly high (lesson not counted)

**Mitigation**:
- Booking code always creates lessons at exact hours (10:00, 11:00, etc.)
- Lessons created outside booking system might not be counted correctly
- **Recommendation**: Round lesson times to nearest hour when matching, OR check if lesson overlaps the time slot

**Location**: Lines 3467, 3536

#### Issue 2: Time Slot Overlap Not Handled
**Problem**: If a lesson overlaps multiple time slots, it's only counted once.

**Example**:
- Lesson: 10:30 - 11:20 (overlaps both 10:00 and 11:00 slots)
- Currently: Only counted in "10:30" slot (if it exists)
- Should: Be counted in both 10:00 and 11:00 slots

**Impact**:
- If lessons can start at non-hour times, they might not be counted in the correct slots
- **Result**: Availability could be incorrectly high

**Mitigation**:
- System assumes all lessons start exactly on the hour
- Booking code enforces this (line 6221: fixed 50-minute duration from exact hour)
- **Recommendation**: Add validation to ensure lessons always start on the hour

**Location**: Lines 3467-3480

#### Issue 3: String Date Comparison
**Problem**: Date comparison uses string comparison: `rowDateStr >= weekStartStr`

**Current Logic**:
- Dates formatted as "yyyy-MM-dd" strings
- Comparison: `"2024-01-15" >= "2024-01-10"` (string comparison)

**Impact**:
- Works correctly for "yyyy-MM-dd" format (lexicographic order matches chronological)
- Could fail if date format changes
- **Result**: Should be fine, but worth noting

**Location**: Line 3471

### 🔍 EDGE CASES TO VERIFY

1. **Lessons at Exact Hour Boundaries**
   - ✅ Should work correctly (e.g., 10:00 lesson matches 10:00 slot)

2. **Lessons at Non-Hour Times**
   - ⚠️ Won't match any slot (e.g., 10:05 lesson won't be counted)

3. **Teacher Shift Boundaries**
   - ✅ Correctly checks if lesson fits within shift

4. **Multiple Teachers, Same Time Slot**
   - ✅ Now correctly deduplicated

5. **Week Spanning Month Boundaries**
   - ✅ Now reads from both MonthlySchedule and NextMonthSchedule

6. **Empty TeacherSchedules Sheet**
   - ✅ Handles gracefully (empty array)

7. **Empty MonthlySchedule Sheet**
   - ✅ Handles gracefully (empty map)

### 📊 ALGORITHM FLOW VERIFICATION

```
For each day (0-6):
  For each time slot (10:00-20:00):
    1. Get available teachers ✓
       - Read from TeacherSchedules
       - Filter by shift times
       - Deduplicate teachers ✓
    
    2. Get existing lessons ✓
       - Read from MonthlySchedule ✓
       - Read from NextMonthSchedule ✓
       - Filter by date range ✓
       - Filter by status = 'scheduled' ✓
       - Match by exact time string ⚠️ (Issue 1)
    
    3. Calculate availability ✓
       - availableSlots = teacherCount - lessonCount ✓
       - Handle edge cases (no teachers, fully booked) ✓
    
    4. Store result ✓
```

### ✅ RECOMMENDATIONS

1. **HIGH PRIORITY**: Fix time matching to handle lessons that don't start exactly on the hour
   - Option A: Round lesson times to nearest hour when matching
   - Option B: Check if lesson overlaps the time slot (more accurate)
   - Option C: Enforce that all lessons must start on the hour (validation)

2. **MEDIUM PRIORITY**: Add logging to track when lessons don't match time slots
   - Log warnings when lessons are skipped due to time mismatch

3. **LOW PRIORITY**: Consider handling overlapping lessons across time slots
   - Only needed if lessons can start at non-hour times

### 📝 SUMMARY

**Overall Algorithm Correctness**: ✅ **MOSTLY CORRECT** with one critical assumption

**Key Assumption**: All lessons start exactly on the hour (10:00, 11:00, etc.)

**If assumption holds**: Algorithm is correct ✅
**If assumption fails**: Lessons at non-hour times won't be counted correctly ⚠️

**Recent Fixes**:
- ✅ Teacher deduplication (fixed duplicate counting)
- ✅ NextMonthSchedule integration (fixed month boundary issues)

**Remaining Risk**:
- ⚠️ Lessons created outside booking system might not be counted if they don't start on the hour



