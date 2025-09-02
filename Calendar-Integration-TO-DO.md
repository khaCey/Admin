# Lesson Rescheduling/Cancellation Feature - TODO List

## 🎯 **Feature Overview**
Add a modal interface to the Latest Records section that allows staff to reschedule or cancel individual lessons. This will integrate with the existing lesson cards in the Latest Record component.

## 📋 **Phase 1: Backend Infrastructure**

### **1.1 Google Calendar API Integration**
- [ ] **Create `rescheduleLesson()` function** in `Code.js`
  - Accept lesson event ID, new date/time, and reason
  - Update Google Calendar event with new time
  - Handle calendar API errors and rate limits
  - Return success/failure status

- [ ] **Create `cancelLesson()` function** in `Code.js`
  - Accept lesson event ID and cancellation reason
  - Update Google Calendar event status to cancelled
  - Add cancellation note to event description
  - Handle calendar API errors and rate limits
  - Return success/failure status

- [ ] **Create `getLessonEventDetails()` function** in `Code.js`
  - Accept lesson event ID
  - Retrieve full event details from Google Calendar
  - Return event data (title, start, end, description, attendees, etc.)
  - Handle missing or invalid event IDs

### **1.2 Data Storage & Tracking**
- [ ] **Create `LessonActions` sheet** in Google Spreadsheet
  - Columns: ActionID, StudentID, StudentName, EventID, ActionType (reschedule/cancel), OldDateTime, NewDateTime, Reason, StaffMember, Timestamp, Status
  - Add data validation and formatting

- [ ] **Create `logLessonAction()` function** in `Code.js`
  - Log all reschedule/cancel actions to LessonActions sheet
  - Include audit trail for compliance
  - Handle duplicate action prevention

- [ ] **Create `getLessonActionHistory()` function** in `Code.js`
  - Retrieve action history for a specific student
  - Filter by date range and action type
  - Return formatted history data

### **1.3 Enhanced Lesson Data Structure**
- [ ] **Update `getStudentEventsForMonth()` function** in `Code.js`
  - Add `eventId` field to returned lesson objects
  - Add `eventTitle` field for lesson description
  - Add `attendees` field for participant information
  - Add `description` field for lesson notes

- [ ] **Create `validateLessonAction()` function** in `Code.js`
  - Check if lesson can be rescheduled (not in past)
  - Validate new time doesn't conflict with other lessons
  - Check staff availability for new time
  - Return validation results with error messages

## 📋 **Phase 2: Frontend Modal Interface**

### **2.1 Modal HTML Structure**
- [ ] **Add lesson action modal HTML** to `Index.html`
  - Modal container with backdrop
  - Header with lesson details and close button
  - Tab interface for "Reschedule" and "Cancel" options
  - Form fields for new date/time and reason
  - Action buttons (Confirm/Cancel)
  - Loading states and error handling

- [ ] **Create modal styling** in `Styles.html`
  - Responsive design for mobile/desktop
  - Consistent with existing modal styles
  - Focus management and accessibility
  - Animation and transition effects

### **2.2 Modal JavaScript Logic**
- [ ] **Create `showLessonActionModal()` function** in `Index.html`
  - Accept lesson data and action type
  - Populate modal with lesson details
  - Show appropriate tab (reschedule/cancel)
  - Handle modal open/close animations

- [ ] **Create `handleLessonReschedule()` function** in `Index.html`
  - Validate form inputs
  - Call backend reschedule function
  - Show loading states and success/error messages
  - Refresh lesson data after successful action

- [ ] **Create `handleLessonCancel()` function** in `Index.html`
  - Validate cancellation reason
  - Call backend cancel function
  - Show loading states and success/error messages
  - Refresh lesson data after successful action

### **2.3 Form Validation & UX**
- [ ] **Implement client-side validation**
  - Date/time picker validation
  - Required field validation
  - Conflict checking for new times
  - Real-time validation feedback

- [ ] **Add confirmation dialogs**
  - "Are you sure?" for cancellations
  - "This will notify the student" for reschedules
  - Warning for same-day changes

## 📋 **Phase 3: Integration with Latest Records**

### **3.1 Lesson Card Interaction**
- [ ] **Update lesson card click handler** in `Index.html`
  - Add click event listener to `.lr-card` elements
  - Extract lesson data from card attributes
  - Show appropriate action modal
  - Handle different lesson statuses (scheduled, cancelled, etc.)

- [ ] **Enhance lesson card data attributes**
  - Add `data-event-id` to lesson cards
  - Add `data-lesson-date` for validation
  - Add `data-lesson-status` for conditional actions
  - Add `data-student-id` for backend calls

### **3.2 Real-time Updates**
- [ ] **Create `refreshLatestRecord()` function** in `Index.html`
  - Refresh lesson data after successful actions
  - Update lesson cards with new status
  - Maintain current month tab selection
  - Handle loading states during refresh

- [ ] **Add optimistic updates**
  - Update UI immediately on action
  - Revert on backend failure
  - Show sync status indicators

## 📋 **Phase 4: Advanced Features**

### **4.1 Notification System**
- [ ] **Create `notifyStudentOfChange()` function** in `Code.js`
  - Send email notification to student
  - Include old and new lesson details
  - Add staff contact information
  - Handle email delivery errors

- [ ] **Create `notifyStaffOfChange()` function** in `Code.js`
  - Notify relevant staff members
  - Include lesson change details
  - Add to staff calendar if needed

### **4.2 Bulk Operations**
- [ ] **Create `bulkRescheduleLessons()` function** in `Code.js`
  - Handle multiple lesson changes
  - Batch calendar API calls
  - Progress tracking and error handling
  - Rollback on partial failures

- [ ] **Add bulk selection UI** in `Index.html`
  - Checkbox selection for multiple lessons
  - Bulk action buttons
  - Progress indicators for bulk operations

### **4.3 Reporting & Analytics**
- [ ] **Create `getLessonChangeReport()` function** in `Code.js`
  - Generate reports on lesson changes
  - Filter by date range, student, staff
  - Export to spreadsheet or PDF
  - Include change reasons and patterns

- [ ] **Add change history view** in `Index.html`
  - Show lesson change history in student details
  - Filter and search capabilities
  - Export functionality

## 🧪 **Phase 5: Testing & Quality Assurance**

### **5.1 Unit Testing**
- [ ] **Test backend functions**
  - Test calendar API integration
  - Test data validation logic
  - Test error handling scenarios
  - Test edge cases (past dates, conflicts)

- [ ] **Test frontend components**
  - Test modal functionality
  - Test form validation
  - Test integration with Latest Records
  - Test responsive design

### **5.2 Integration Testing**
- [ ] **End-to-end testing**
  - Complete reschedule workflow
  - Complete cancellation workflow
  - Error handling scenarios
  - Performance testing with large datasets

### **5.3 User Acceptance Testing**
- [ ] **Staff training materials**
  - Create user guide for new feature
  - Record demo videos
  - Create troubleshooting guide
  - Gather feedback and iterate

## 📋 **Phase 6: Deployment & Documentation**

### **6.1 Code Organization**
- [ ] **Create `LessonActions.js` module** (future modularization)
  - Move lesson action functions to separate file
  - Create clean API for lesson management
  - Add comprehensive documentation

- [ ] **Update existing documentation**
  - Update README.md with new feature
  - Add API documentation
  - Update user guides
  - Create changelog entries

### **6.2 Performance Optimization**
- [ ] **Optimize calendar API calls**
  - Implement caching for calendar events
  - Batch API requests where possible
  - Add rate limiting and retry logic
  - Monitor API quota usage

- [ ] **Optimize UI performance**
  - Lazy load lesson data
  - Debounce form inputs
  - Optimize modal rendering
  - Add loading skeletons

## ✅ **Success Criteria**

### **Functional Requirements**
- [ ] Staff can reschedule lessons with new date/time
- [ ] Staff can cancel lessons with reason
- [ ] All changes are logged and auditable
- [ ] Students are notified of changes
- [ ] Calendar is updated automatically
- [ ] Latest Records refresh after changes

### **Non-Functional Requirements**
- [ ] Response time < 2 seconds for actions
- [ ] 99% uptime for calendar integration
- [ ] Mobile-responsive interface
- [ ] Accessible to screen readers
- [ ] Comprehensive error handling
- [ ] Data integrity maintained

### **User Experience**
- [ ] Intuitive interface for staff
- [ ] Clear feedback for all actions
- [ ] Consistent with existing UI patterns
- [ ] Minimal training required
- [ ] Reduces manual calendar management

---

**Estimated Timeline**: 4-6 weeks  
**Priority**: High (directly impacts daily operations)  
**Dependencies**: Google Calendar API, existing Latest Records component  
**Risk Level**: Medium (calendar integration complexity)

## 📝 **Implementation Notes**

### **Technical Considerations**
- Google Calendar API has rate limits (1000 requests per 100 seconds)
- Need to handle timezone differences between staff and students
- Calendar events may have recurring patterns that need special handling
- Need to consider calendar permissions and access rights

### **Business Rules**
- Same-day cancellations may have different policies
- Rescheduling should respect teacher availability
- Cancellations should include refund policies
- All changes should be communicated to students

### **Security & Compliance**
- Audit trail for all lesson changes
- Data retention policies for action logs
- Access control for lesson modification
- Privacy considerations for student notifications

### **Future Enhancements**
- Integration with payment system for refunds
- Automated conflict detection
- Smart scheduling suggestions
- Mobile app integration
- Multi-language support for notifications
