# Student Admin System - Cursor Setup Prompt

## Project Context

This is a Google Apps Script web application for comprehensive student management at GreenSquare language school in Japan. The system handles student registration, payment tracking, lesson scheduling, notes management, and provides analytics through a modern web interface.

## Versioning System

**Dual Versioning System:**
- **App Version** (v1.0.0): Increments when deployed to Google Apps Script
- **Development Version** (v1.0.0.01, v1.0.0.02, etc.): Increments with each code change

**Current Version:** v1.0.0.15

## File Structure

### Core Files
- `Code.js` - Main Google Apps Script backend logic (2311 lines)
- `Index.html` - Primary web interface and client-side JavaScript
- `Dashboard.html` - Dashboard components and analytics
- `Students.html` - Student list view components
- `PaymentLogs.html` - Payment tracking interface
- `Styles.html` - CSS styles and theming
- `README.md` - Comprehensive documentation

### Script Components
- `FormScripts.html` - Form handling and validation
- `ListScripts.html` - List view functionality and search
- `DetailsScripts.html` - Student details modal and interactions
- `PaymentScripts.html` - Payment management and calculations
- `NoteScripts.html` - Notes system and communication
- `RecordScripts.html` - Record management utilities
- `DashboardScripts.html` - Dashboard analytics and charts
- `HelperFunctions.html` - Utility functions and helpers

### Notification System
- `NotificationScripts.html` - Notification management
- `NotificationStyles.html` - Notification-specific styling
- `NotificationDemo.html` - Notification demonstration interface

### Migration and Utilities
- `Migration.js` - Data migration utilities
- `PaymentMigration.js` - Payment data migration tools
- `当日キャンセル.js` - Same-day cancellation tracking

### Configuration
- `appsscript.json` - Google Apps Script configuration
- `.clasp.json` - CLASP deployment configuration

## Key Features

### Student Management System
- Complete CRUD operations for student records
- Japanese and English name support (漢字 field)
- Google Contacts integration for new students
- Advanced search and filtering capabilities
- Student status tracking (Active/Dormant)

### Payment Tracking System
- Comprehensive payment logging with transaction history
- Automated fee calculations based on lesson types
- Payment method tracking and staff attribution
- Monthly payment summaries and analytics
- Discount application and total calculations

### Lesson Scheduling Integration
- Google Calendar integration for lesson management
- Automated lesson counting and tallying
- Student attendance tracking
- Same-day cancellation handling (当日キャンセル)

### Notes and Communication
- Detailed student notes and communication logs
- Staff attribution for all notes
- Searchable note history
- Date-stamped communication tracking

### Dashboard Analytics
- Real-time student statistics
- Payment analytics and revenue reports
- Lesson tracking and attendance summaries
- Interactive charts and visualizations

### Notification System
- Real-time notification management
- Interactive notification interface
- Notification demo for testing
- Badge counters and dropdown menus

## Development Workflow

### When Making Changes:
1. **Increment development version** (e.g., v1.0.0.01 → v1.0.0.02)
2. **Update CHANGELOG.md** with new entry
3. **Document changes** in Added/Fixed/Changed categories
4. **Test functionality** before marking complete

### Changelog Format:
```markdown
## [v1.0.0.02] - 2024-12-19

### Added
- New feature description

### Fixed
- Bug fix description

### Changed
- Modified functionality description
```

## Important Code Patterns

### Spreadsheet Integration
- Use `SS_ID` constant for spreadsheet reference
- Sheet names: `Students`, `Payment`, `Notes`, `Lessons`, `PaymentLogs`
- Always use `getDisplayValues()` for data retrieval
- Handle empty data ranges properly

### Student Data Structure
- **ID**: Auto-incrementing unique identifier
- **FirstName/LastName**: English names
- **漢字**: Japanese kanji names
- **Email/Phone**: Contact information
- **Status**: Active/Dormant status


### Payment Data Structure
- **Transaction ID**: Unique payment identifier
- **Student ID**: Reference to student record
- **Year/Month**: Payment period
- **Amount/Discount/Total**: Financial calculations
- **Date**: Payment timestamp
- **Method**: Payment method used
- **Staff**: Processing staff member

### Google Services Integration
- **Calendar**: `LESSON_CALENDAR_ID` for lesson scheduling
- **Contacts**: Automatic contact creation for new students
- **Sheets**: Primary data storage with advanced services
- **People API**: Contact management integration

## Key Functions

### Core Functions (Code.js)
- `getStudents()` - Retrieve all student records
- `addStudent(student)` - Add new student with contact creation
- `updateStudent(student)` - Update existing student record
- `deleteStudent(id)` - Delete student and related data
- `getAllPayments()` - Retrieve complete payment history
- `insertPayment(pay)` - Add new payment record
- `getLessonEventsForMonth()` - Fetch calendar events
- `tallyLessonsForMonthAndStore()` - Count and store lesson data

### Client Functions (Index.html)
- `showStudents()` - Display student list view
- `showPayments()` - Display payment interface
- `showForm()` - Show student addition form
- `searchStudents()` - Search and filter students
- `showStudentDetails(id)` - Display student details modal
- `showNotificationDemo()` - Display notification interface

### Payment Functions (PaymentScripts.html)
- `calculateFee()` - Calculate lesson fees
- `processPayment()` - Handle payment submission
- `loadPaymentHistory()` - Load payment records
- `exportPayments()` - Export payment data

### Dashboard Functions (DashboardScripts.html)
- `loadDashboardStats()` - Load analytics data
- `updateCharts()` - Update dashboard charts
- `refreshAnalytics()` - Refresh dashboard data

## Testing Checklist

Before marking changes complete:
- [ ] Student CRUD operations work correctly
- [ ] Payment calculations are accurate
- [ ] Google Contacts integration functions
- [ ] Calendar integration works properly
- [ ] Search and filtering work as expected
- [ ] Dashboard analytics display correctly
- [ ] Notification system functions properly
- [ ] Mobile responsiveness maintained
- [ ] No console errors in browser
- [ ] Data integrity preserved

## Common Issues

### Spreadsheet Access
- Verify `SS_ID` is correct and accessible
- Check sheet names match exactly
- Ensure proper permissions for Google Apps Script

### Calendar Integration
- Verify `LESSON_CALENDAR_ID` is correct
- Check calendar sharing permissions
- Test calendar event creation and retrieval

### Contact Creation
- Ensure Google People API is enabled
- Check contact creation error handling
- Verify contact data mapping

### Payment Calculations
- Test fee calculation logic thoroughly
- Verify discount application
- Check total calculation accuracy

### UI Responsiveness
- Test on mobile devices
- Verify Bootstrap components work
- Check sidebar toggle functionality

## Deployment Notes

### Google Apps Script Setup
- Deploy as web app in Google Apps Script
- Set access to "Myself only" (private access)
- Execute as "User accessing the web app"
- Enable advanced services (Sheets, People)

### Required APIs
- Google Sheets API (v4)
- Google People API (v1)
- Google Calendar API
- Google Apps Script API

### Spreadsheet Requirements
- Create sheets: `Students`, `Payment`, `Notes`, `Lessons`, `PaymentLogs`
- Set up proper column headers
- Configure data validation rules
- Set up conditional formatting

### CLASP Deployment
```bash
npm install -g @google/clasp
clasp login
clasp push
clasp deploy
```

## Security Considerations

### Data Protection
- All data stored in Google Sheets (encrypted)
- User-based access control
- API key management through Google
- Secure HTTPS transmission

### Access Control
- Private access (myself only)
- User authentication required
- Audit logging available
- Permission-based feature access

## Performance Optimization

### Data Loading
- Implement pagination for large datasets
- Use efficient spreadsheet queries
- Cache frequently accessed data
- Optimize chart rendering

### UI Performance
- Lazy load components
- Debounce search inputs
- Optimize modal rendering
- Minimize DOM manipulation

---

**Use this prompt to quickly set up the same development environment and workflow on any Cursor instance for the Student Admin System.**
