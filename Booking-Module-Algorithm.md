# Booking Module Algorithm - Detailed Process Flow

## Overview
This document describes the algorithm for the new availability-based booking module that only shows time slots where:
1. Teachers are available
2. There are no lessons scheduled at that time slot (the slot is free)
3. There are available slots (teachers - existing lessons > 0)

---

## Data Sources

### 1. Teacher Availability
- **Source**: `TeacherSchedules` sheet (cached teacher shift data)
- **Function**: `getAvailableTeachersForTime(dateTime, durationMinutes)`
- **Returns**: Array of teacher objects available at the specified time
- **Columns Used**: Date, TeacherName, StartTime, EndTime

### 2. Existing Lessons
- **Source**: `MonthlySchedule` sheet (cached lesson data)
- **Function**: `getExistingLessonsFromSheet(startDate)`
- **Returns**: Object mapping `{date: {time: [lessons]}}`
- **Columns Used**: Start, End, StudentName, Status, EventID, Title
- **Filter**: Only counts lessons with Status = 'scheduled' (excludes cancelled, rescheduled, reserved)

### 3. Student Information (Optional)
- **Source**: `Students` sheet
- **Function**: `getStudents()`
- **Used**: Optional - for logging/debugging purposes only, not used for filtering

---

## Main Algorithm: `getAvailableSlotsForWeek()`

### Input Parameters
- `weekStartISO`: ISO string of Monday of the week (e.g., "2024-01-15T00:00:00.000Z")
- `studentId`: Student ID string (optional - only used for logging/context, not for filtering)
- `teacherFilter`: Array of teacher names (optional - if provided, only show slots where these teachers are available)
  - Example: `["Teacher1", "Teacher2"]` or `null` for all teachers

### Output
JSON string with structure:
```json
{
  "2024-01-15": {
    "10:00": {
      "available": true,
      "teacherCount": 3,
      "lessonCount": 1,
      "availableSlots": 2,
      "teachers": ["Teacher1", "Teacher2", "Teacher3"]
    },
    "11:00": {
      "available": false,
      "reason": "No available slots",
      "teacherCount": 2,
      "lessonCount": 2,
      "availableSlots": 0
    }
  }
}
```

---

## Step-by-Step Process

### Step 1: Validate Input
```
1. Parse weekStartISO to Date object
2. Calculate weekEnd (weekStart + 7 days)
3. (Optional) Get student name from Students sheet using studentId for logging
4. Validate teacherFilter (if provided):
   - Should be an array of teacher name strings
   - If empty array or null, treat as "no filter" (show all teachers)
   - Normalize teacher names (trim whitespace, handle case sensitivity if needed)
```

### Step 2: Initialize Result Structure
```
1. Create empty object: availableSlots = {}
2. Define time slots array: ['10:00', '11:00', ..., '20:00']
3. Loop through each day (0-6, Monday to Sunday)
   a. Calculate dayDate = weekStart + day offset
   b. Format as "YYYY-MM-DD"
   c. Initialize availableSlots[dateStr] = {}
```

### Step 3: Check Each Time Slot
For each day and each time slot:

```
3.1 Check Teacher Availability and Existing Lessons
    ├─ Call checkTimeSlotAvailability(dateStr, timeStr)
    │  This function:
    │  a. Creates DateTime object from dateStr + timeStr
    │  b. Calls getAvailableTeachersForTime(dateTime, 50)
    │     - Gets teacher shifts from TeacherSchedules sheet
    │     - Filters teachers whose shifts cover the time slot
    │     - Returns array of available teachers
    │  c. Counts existing lessons from MonthlySchedule
    │     - Filters by date and time match
    │     - Only counts Status = 'scheduled'
    │     - Counts ALL lessons at that time (not student-specific)
    │  d. Returns:
    │     {
    │       teacherCount: number (all available teachers),
    │       lessonCount: number,
    │       teachers: [array of all available teacher names]
    │     }
    │
3.2 Apply Teacher Filter (if provided)
    ├─ If teacherFilter is provided and not empty:
    │  a. Filter the teachers array to only include teachers in teacherFilter
    │  b. Update teacherCount to filtered count
    │  c. Store filteredTeachers array
    └─ If teacherFilter is null/empty:
       └─ Use all teachers (no filtering)

3.3 Calculate Availability
    ├─ Calculate: availableSlots = filteredTeacherCount - lessonCount
    └─ Evaluate result:
       ├─ If availableSlots > 0:
       │  └─ Mark as AVAILABLE, store:
       │     - teacherCount: filteredTeacherCount
       │     - lessonCount: lessonCount
       │     - availableSlots: availableSlots
       │     - teachers: filteredTeachers (or all teachers if no filter)
       └─ If availableSlots <= 0:
          └─ Mark as UNAVAILABLE
             Set reason: 
             - "No available slots" (if teachers available but fully booked)
             - "No teachers available" (if no teachers match filter)
             - "Selected teachers not available" (if filter provided but no matches)
```

### Step 4: Return Results
```
1. Convert availableSlots object to JSON string
2. Log summary (number of days processed)
3. Return JSON string
```

---

## Decision Logic Flowchart

```
For each time slot (day × time):
│
├─ [Check teacher availability]
│  ├─ Get all available teachers
│  ├─ Get existing lessons count (ALL lessons at this time, not student-specific)
│  │
│  ├─ [Teacher filter provided?]
│  │  ├─ YES → Filter teachers to only include selected teachers
│  │  │        Update teacherCount to filtered count
│  │  └─ NO → Use all available teachers
│  │
│  └─ Calculate: availableSlots = filteredTeacherCount - lessons
│
└─ [availableSlots > 0?]
   ├─ YES → Mark AVAILABLE
   │         Store: filteredTeacherCount, lessonCount, availableSlots, filteredTeachers
   └─ NO → Mark UNAVAILABLE
            Reason: "No available slots" or "Selected teachers not available"
```

## Key Logic Points

1. **No Student Conflict Check**: The algorithm does NOT check if the student already has a lesson. It only checks if the time slot itself is free (has teachers and no lessons scheduled).

2. **General Availability**: A slot is available if:
   - There is at least 1 teacher available
   - The number of existing lessons is less than the number of teachers
   - Formula: `availableSlots = teacherCount - lessonCount > 0`

3. **Student ID Usage**: The studentId parameter is optional and only used for:
   - Logging/debugging purposes
   - Future enhancements (if needed)
   - NOT used to filter out student's existing lessons

4. **Teacher Filtering**: The teacherFilter parameter allows filtering slots by specific teachers:
   - If provided: Only show slots where at least one of the selected teachers is available
   - If null/empty: Show all available slots (no teacher filter)
   - Filtering happens after getting all available teachers, so it's a post-processing step
   - Example: If 3 teachers available but filter is ["Teacher1"], only Teacher1's availability counts

---

## Frontend Integration Algorithm

### Function: `createSimpleBookingCalendar(weekStart, teacherFilter)`

```
1. Clear calendar grid
2. Show loading spinner
3. Get studentId from window.student object (optional)
4. Get teacherFilter from UI (teacher dropdown/checkbox selection)
5. Call backend: getAvailableSlotsForWeek(weekStart, studentId, teacherFilter)
6. On success:
   a. Parse JSON response
   b. Call generateAvailabilityCalendar(weekStart, availableSlots)
7. On error:
   a. Display error message in calendar grid
```

### Function: `setupTeacherFilter()`

```
1. Get list of all teachers (from backend or cached)
2. Create UI element (dropdown or multi-select):
   - Default: "All Teachers" (no filter)
   - Options: Individual teacher names
   - Allow multiple selection if needed
3. Add change event listener:
   - When selection changes, call createSimpleBookingCalendar() with new filter
   - Re-render calendar with filtered results
```

### Function: `generateAvailabilityCalendar(weekStart, availableSlots)`

```
1. Clear calendar grid
2. Define time slots: ['10:00', '11:00', ..., '20:00']
3. For each time slot:
   a. Create time column cell (left side)
   b. For each day (0-6, Mon-Sun):
      ├─ Calculate dateStr = "YYYY-MM-DD"
      ├─ Get availability data: availableSlots[dateStr][timeStr]
      │
      ├─ If NOT available:
      │  ├─ Style: gray background, cursor-not-allowed
      │  ├─ Title: reason (e.g., "No available slots")
      │  └─ No click handler
      │
      └─ If AVAILABLE:
         ├─ Style: green background, cursor-pointer, border
         ├─ Title: "Available (X slots) - Click to book"
         ├─ Display: Show availableSlots count
         └─ Add click handler → selectTimeSlot(cell, date, time)
4. Append all cells to calendar grid
```

---

## Data Structures

### Availability Data Structure
```javascript
{
  "2024-01-15": {           // Date string
    "10:00": {              // Time string
      available: boolean,
      teacherCount: number,  // Count of available teachers (after filter if applied)
      lessonCount: number,
      availableSlots: number,
      teachers: [string],   // Array of available teacher names (filtered if filter applied)
      reason: string        // Optional: if unavailable
    },
    "11:00": { ... },
    ...
  },
  "2024-01-16": { ... }
}
```

**Note**: When teacherFilter is applied:
- `teacherCount` reflects only the filtered teachers
- `teachers` array contains only the filtered teachers that are available
- `availableSlots` is calculated based on filtered teacher count

### Lesson Object (from MonthlySchedule)
```javascript
{
  eventID: string,
  title: string,
  studentName: string,
  status: string,           // 'scheduled', 'cancelled', 'rescheduled', etc.
  startTime: Date,
  endTime: Date
}
```

---

## Edge Cases and Special Handling

### 1. Time Zone Handling
- **Issue**: Dates must be consistent across all functions
- **Solution**: Always use `Session.getScriptTimeZone()` for formatting
- **Format**: Use "yyyy-MM-dd" for dates, "HH:mm" for times

### 2. Lesson Status Filtering
- **Issue**: Should not count cancelled/rescheduled lessons
- **Solution**: Only count lessons with Status = 'scheduled' or empty string
- **Implementation**: Filter in `checkTimeSlotAvailability()`

### 3. Missing Data
- **Issue**: TeacherSchedules sheet may not exist or be empty
- **Solution**: Return empty array, mark slots as unavailable
- **Error Handling**: Log warning, continue processing

### 4. Week Range Calculation
- **Issue**: Week boundaries must be consistent
- **Solution**: Use Monday as week start, calculate weekEnd = weekStart + 7 days
- **Format**: Use ISO date strings for consistency

### 5. Time Slot Overlap
- **Issue**: Lessons are 50 minutes, but we check hourly slots
- **Solution**: Current implementation checks exact time match (10:00, 11:00, etc.)
- **Note**: This assumes lessons start on the hour. If lessons can start at :30, need to adjust logic

---

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**
   - Process all time slots for a week in one backend call
   - Reduces round trips between frontend and backend

2. **Cached Data**
   - TeacherSchedules sheet is pre-cached
   - MonthlySchedule sheet is pre-cached
   - No real-time calendar API calls during availability check

3. **Data Filtering**
   - Filter lessons by week range before processing
   - Only process relevant data

### Expected Performance
- **Backend call**: ~1-2 seconds for full week (77 time slots: 7 days × 11 hours)
- **Frontend rendering**: <100ms for calendar grid
- **Total user wait time**: ~1-2 seconds

---

## Error Handling

### Backend Errors
```javascript
{
  error: "Error message string"
}
```

### Frontend Error Display
- Show error message in calendar grid area
- Red text, clear message
- Allow user to retry or close modal

### Logging
- All functions log to Logger for debugging
- Include: function name, parameters, results, errors

---

## Testing Scenarios

### Scenario 1: Free Time Slot
- **Expected**: Slot marked available
- **Test**: Time slot with teachers available and no lessons scheduled
- **Example**: 3 teachers, 0 lessons → 3 slots available

### Scenario 2: Partially Booked Time Slot
- **Expected**: Slot marked available if capacity remains
- **Test**: Time slot with some lessons but teachers still available
- **Example**: 3 teachers, 1 lesson → 2 slots available

### Scenario 3: Fully Booked Time Slot
- **Expected**: Slot marked unavailable (all teachers booked)
- **Test**: Time slot where teacherCount === lessonCount

### Scenario 4: Student Has Lesson at This Time
- **Expected**: Slot still shows as available if capacity exists
- **Test**: Student has lesson Monday 10:00, but there are still free teachers
- **Example**: 3 teachers, 1 lesson (including student's) → 2 slots available, slot shows as AVAILABLE
- **Note**: The algorithm does NOT filter out slots where the student already has a lesson

### Scenario 5: No Teachers Available
- **Expected**: Slot marked unavailable
- **Test**: Time slot outside teacher shift hours

### Scenario 6: Week Boundary
- **Expected**: Only show slots within the selected week
- **Test**: Week starting Monday, should not show previous Sunday

### Scenario 7: Teacher Filter Applied
- **Expected**: Only show slots where selected teachers are available
- **Test**: Filter by "Teacher1", slot with Teacher1 available shows, slot with only Teacher2 available doesn't show
- **Example**: 
  - All teachers: [Teacher1, Teacher2, Teacher3] available
  - Filter: ["Teacher1"]
  - Result: Only slots where Teacher1 is available are shown

### Scenario 8: Teacher Filter with No Matches
- **Expected**: Slot marked unavailable if no filtered teachers are available
- **Test**: Filter by "Teacher1", but only Teacher2 and Teacher3 are available at that time
- **Result**: Slot shows as unavailable with reason "Selected teachers not available"

---

## Integration Points

### Backend Functions to Create/Modify

1. **`getAvailableSlotsForWeek(weekStartISO, studentId, teacherFilter)`** - NEW
   - Main function that orchestrates the algorithm
   - studentId is optional (for logging only)
   - teacherFilter is optional (array of teacher names to filter by)
   - Location: `Code.js`

2. **`checkTimeSlotAvailability(dateStr, timeStr)`** - EXISTS
   - Already implemented, no changes needed
   - Location: `Code.js` (line ~2523)

3. **`getAvailableTeachersForTime(dateTime, durationMinutes)`** - EXISTS
   - Already implemented, no changes needed
   - Location: `Code.js` (line ~2496)

### Frontend Functions to Modify

1. **`createSimpleBookingCalendar(weekStart, teacherFilter)`** - MODIFY
   - Change to call new backend function with teacherFilter parameter
   - Location: `Index.html` (line ~3881)

2. **`setupTeacherFilter()`** - NEW
   - Creates teacher filter UI (dropdown/multi-select)
   - Handles filter changes and re-renders calendar
   - Location: `Index.html` (add in booking modal section)

3. **`generateAvailabilityCalendar(weekStart, availableSlots)`** - NEW
   - Renders calendar based on availability data
   - Location: `Index.html` (add after createSimpleBookingCalendar)

4. **`openBookLessonModal({ student, onClose })`** - MODIFY
   - Initialize teacher filter UI when modal opens
   - Call setupTeacherFilter() to create filter dropdown
   - Already calls createSimpleBookingCalendar
   - Location: `Index.html` (line ~3173)

---

## Summary

The algorithm works by:
1. **Checking** teacher availability for each time slot
2. **Filtering** by selected teachers (if teacher filter is provided)
3. **Counting** existing lessons at each time slot (all lessons, not student-specific)
4. **Calculating** available slots = filteredTeachers - existing lessons
5. **Displaying** only slots with availableSlots > 0

This ensures users can only book lessons when:
- Selected teachers are available (if filter applied) OR any teachers are available (if no filter)
- The time slot is free (no lessons scheduled, or capacity remains)
- There's capacity (availableSlots > 0)

**Important Notes**:
- The algorithm does NOT check if the student already has a lesson at that time. It only checks if the time slot itself has available capacity.
- Teacher filtering is optional - if no filter is provided, all available teachers are considered.
- When a teacher filter is applied, only slots where at least one of the selected teachers is available will be shown.

