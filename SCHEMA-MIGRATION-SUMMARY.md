# MonthlySchedule Schema Migration Summary

## Changes Applied

The MonthlySchedule sheet schema has been updated from:
- **Old**: `Start` (Date/Time), `End` (Date/Time)
- **New**: `Date` (date only), `StartTime` (time only), `EndTime` (time only)

## Updated Schema

```
MonthlySchedule columns:
- EventID
- Title
- Date (yyyy-MM-dd format)
- StartTime (HH:mm format)
- EndTime (HH:mm format)
- Status
- StudentName
- IsKidsLesson
- TeacherName
```

## Migration Function

A migration function `migrateMonthlyScheduleSchema()` has been added. **Run this once** to migrate existing data:

```javascript
migrateMonthlyScheduleSchema()
```

This function will:
1. Check if migration is needed
2. Add Date, StartTime, EndTime columns
3. Migrate data from Start/End columns
4. Update headers
5. Remove old Start/End columns

## Functions Updated

All functions have been updated with backward compatibility:

### Write Functions
1. ✅ `getMonthlyScheduleSheet_()` - Schema definition
2. ✅ `upsertMonthlyScheduleRow_()` - Write new rows
3. ✅ `updateMonthlyScheduleStatus_()` - Update existing rows
4. ✅ `processEventsForMonth()` - Process calendar events
5. ✅ `cacheEventsToSheet()` - Cache events to sheet

### Read Functions
6. ✅ `readLessonsFromSheet()` - Read lessons for availability calculation
7. ✅ `getStudentEventsForMonth()` - Get student lessons for a month
8. ✅ `getStudentEventsFromSheet()` - Get student events from sheet
9. ✅ `getExistingLessonsFromSheet()` - Get existing lessons for booking
10. ✅ `getAllStudentDataForCacheBatched()` - Batch data loading
11. ✅ `tallyLessonsForMonthAndStore()` - Tally lessons for stats
12. ✅ `getStudentsWithLessonsToday()` - Get today's lessons
13. ✅ `getStudentsWithLessonsThisMonth()` - Get this month's lessons

## Backward Compatibility

All functions include backward compatibility:
- Check for new schema columns (Date, StartTime, EndTime)
- Fall back to old schema (Start, End) if new columns not found
- Log warnings when old schema is detected

## Benefits

1. **Clearer Data Structure**: Date and time are explicitly separated
2. **Easier Matching**: Exact string match on date and time (no parsing needed)
3. **Better Debugging**: Can see dates and times directly in spreadsheet
4. **No Format Confusion**: No ambiguity between MM/DD/YYYY vs DD/MM/YYYY
5. **Consistent Format**: Matches time slot format used in algorithm ("13:00")

## Next Steps

1. **Run Migration**: Execute `migrateMonthlyScheduleSchema()` once
2. **Verify Data**: Check that all lessons migrated correctly
3. **Test Functions**: Test booking, calendar display, and lesson retrieval
4. **Monitor Logs**: Check for any warnings about old schema usage

## Notes

- The migration function preserves all existing data
- Old Start/End columns are removed after migration
- All functions work with both old and new schema during transition
- No data loss during migration

