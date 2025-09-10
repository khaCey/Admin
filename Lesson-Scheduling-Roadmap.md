# 🎯 **Lesson Scheduling System Roadmap**

## **Project Overview**
Transform the current Google Calendar-based lesson scheduling into an app-centric system with comprehensive validation and business rule enforcement.

## **Core Business Rules**
1. **Kids vs Adults Separation**: Kids lessons cannot be booked with adult lessons
2. **Teacher Availability**: Lessons can only be booked if there are enough teachers available

## **Current State**
- **Single Calendar**: `LESSON_CALENDAR_ID` - 'greensquare.jp_h8u0oufn8feana384v67o46o78@group.calendar.google.com'
- **Read Operations**: App fetches events from Google Calendar
- **Manual Scheduling**: Staff directly edit Google Calendar (causes errors)
- **No Validation**: No business rule enforcement

## **Target State**
- **App-Centric**: App becomes single source of truth for lesson scheduling
- **Google Calendar as Database**: Calendar used only for viewing and data storage
- **Comprehensive Validation**: All business rules enforced automatically
- **Real-time Feedback**: Immediate validation and conflict detection

---

## **📋 Phase 1: Teacher Management System (Week 1-2)**

### **1.1 Teacher Configuration**
```javascript
// Add to Code.js
var TEACHER_CONFIG = {
  teachers: [
    { id: 'teacher1', name: 'Teacher A', available: true, maxLessonsPerDay: 8 },
    { id: 'teacher2', name: 'Teacher B', available: true, maxLessonsPerDay: 8 },
    { id: 'teacher3', name: 'Teacher C', available: true, maxLessonsPerDay: 6 }
  ],
  requirements: {
    'Individual': 1,  // 1 teacher per individual lesson
    'Group': 1        // 1 teacher per group lesson (regardless of size)
  }
};
```

### **1.2 Core Functions**
- [ ] `getAvailableTeachers(dateTime, duration)` - Get teachers available for specific time
- [ ] `checkTeacherAvailability(dateTime, duration, lessonType)` - Check if enough teachers available
- [ ] `assignTeacherToLesson(dateTime, duration, lessonType)` - Assign teacher to lesson
- [ ] `getLessonsInTimeRange(startTime, endTime)` - Get existing lessons in time range

### **1.3 Deliverables**
- [ ] Teacher management system implemented
- [ ] Availability checking functions working
- [ ] Teacher assignment logic tested
- [ ] Integration with existing calendar functions

---

## **📋 Phase 2: Student Type Separation (Week 2-3)**

### **2.1 Student Type Detection**
```javascript
function getStudentType(student) {
  // Check if student is a child
  if (student['子'] === '子' || student.child === true) {
    return 'child';
  } else {
    return 'adult';
  }
}
```

### **2.2 Compatibility Validation**
- [ ] `validateStudentTypeCompatibility(lessonData, existingLessons)` - Check for type conflicts
- [ ] `getAllLessonsForDateRange(startTime, duration)` - Get lessons in time range
- [ ] Time overlap detection logic
- [ ] Conflict resolution messaging

### **2.3 Deliverables**
- [ ] Student type detection working
- [ ] Kids vs adults separation enforced
- [ ] Time conflict detection implemented
- [ ] Clear error messages for conflicts

---

## **📋 Phase 3: Comprehensive Validation System (Week 3-4)**

### **3.1 Main Validation Function**
```javascript
function validateLessonScheduling(lessonData) {
  // 1. Check teacher availability
  // 2. Check kids vs adults separation
  // 3. Check business hours (9 AM - 6 PM)
  // 4. Check advance booking (max 90 days)
  // 5. Check student status restrictions
  // 6. Check payment type restrictions
}
```

### **3.2 Business Rules Integration**
- [ ] Teacher availability validation
- [ ] Student type compatibility checking
- [ ] Business hours enforcement
- [ ] Advance booking limits
- [ ] Status-based restrictions (Demo, Active, Dormant)
- [ ] Payment type validation (NEO vs OLD)

### **3.3 Deliverables**
- [ ] Complete validation system
- [ ] All business rules enforced
- [ ] Comprehensive error handling
- [ ] Validation testing completed

---

## **📋 Phase 4: Enhanced User Interface (Week 4-5)**

### **4.1 Scheduling Modal**
```html
<!-- New modal in Index.html -->
<div id="scheduleLessonModal" class="modal">
  <!-- Student selection with type display -->
  <!-- Date/time picker with validation -->
  <!-- Duration selection -->
  <!-- Lesson type selection -->
  <!-- Real-time validation display -->
  <!-- Teacher availability indicator -->
  <!-- Student type compatibility indicator -->
</div>
```

### **4.2 Real-time Validation**
- [ ] `setupRealTimeValidation()` - Set up form validation listeners
- [ ] `validateForm()` - Real-time form validation
- [ ] `updateValidationDisplay()` - Update UI with validation results
- [ ] `updateStudentInfoDisplay()` - Show student type and status

### **4.3 Visual Indicators**
- [ ] Teacher availability status (✅/❌)
- [ ] Student type compatibility (✅/❌)
- [ ] Student type badges (👶 Child / 👨 Adult)
- [ ] Status badges (Demo, Active, Dormant)
- [ ] Real-time error messages

### **4.4 Deliverables**
- [ ] Enhanced scheduling modal
- [ ] Real-time validation working
- [ ] Visual indicators implemented
- [ ] Responsive design completed
- [ ] User experience testing

---

## **📋 Phase 5: Calendar Integration (Week 5-6)**

### **5.1 Enhanced Calendar Functions**
```javascript
function createLessonEvent(lessonData) {
  // 1. Validate lesson scheduling
  // 2. Assign teacher
  // 3. Determine calendar (Student Schedule vs Demo Lessons)
  // 4. Create calendar event with teacher info
  // 5. Log action to audit trail
}
```

### **5.2 Multi-Calendar Support**
- [ ] `getCalendarForStudent(student)` - Determine correct calendar
- [ ] `CALENDAR_CONFIG` - Configuration for multiple calendars
- [ ] Student Schedule calendar for Active/Dormant students
- [ ] Demo Lessons calendar for Demo students

### **5.3 Audit Trail**
- [ ] `logLessonAction(actionData)` - Log all lesson actions
- [ ] LessonActions sheet creation
- [ ] Action history tracking
- [ ] Teacher assignment logging

### **5.4 Deliverables**
- [ ] Calendar write operations working
- [ ] Multi-calendar support implemented
- [ ] Teacher assignment in calendar events
- [ ] Complete audit trail system
- [ ] End-to-end testing completed

---

## **📋 Phase 6: Migration & Training (Week 6-7)**

### **6.1 Migration Strategy**
- [ ] **Phase 1**: Parallel operation (both systems work)
- [ ] **Phase 2**: App-only for new events
- [ ] **Phase 3**: Full app control

### **6.2 Staff Training**
- [ ] Create user guide for new scheduling interface
- [ ] Record demo videos
- [ ] Conduct training sessions
- [ ] Provide ongoing support

### **6.3 Testing & Quality Assurance**
- [ ] Unit testing for all functions
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance testing

### **6.4 Deliverables**
- [ ] Migration plan executed
- [ ] Staff trained on new system
- [ ] All testing completed
- [ ] System fully operational

---

## **🎯 Success Criteria**

### **Functional Requirements**
- [ ] Staff can schedule lessons through the app
- [ ] Kids and adults are kept separate automatically
- [ ] Teacher availability is checked before booking
- [ ] All business rules are enforced
- [ ] Complete audit trail for all actions
- [ ] Real-time validation and feedback

### **Non-Functional Requirements**
- [ ] Response time < 2 seconds for scheduling
- [ ] 99% uptime for calendar integration
- [ ] Mobile-responsive interface
- [ ] Comprehensive error handling
- [ ] Data integrity maintained

### **User Experience**
- [ ] Intuitive scheduling interface
- [ ] Clear validation messages
- [ ] Consistent with existing app design
- [ ] Minimal training required
- [ ] Reduces manual calendar management

---

## **🚨 Risk Mitigation**

### **Technical Risks**
- **Calendar API Limits**: Implement batching and caching
- **Data Inconsistency**: Add validation and sync monitoring
- **Performance Issues**: Optimize queries and add loading states
- **Integration Failures**: Add comprehensive error handling

### **Business Risks**
- **Staff Resistance**: Gradual migration and comprehensive training
- **System Downtime**: Backup procedures and rollback plans
- **Data Loss**: Comprehensive backup and audit trails
- **User Errors**: Extensive validation and confirmation dialogs

---

## **📅 Timeline Summary**

| Week | Phase | Focus | Deliverables |
|------|-------|-------|--------------|
| 1-2 | Teacher Management | Backend infrastructure | Teacher availability system |
| 2-3 | Student Type Separation | Kids vs adults logic | Type compatibility validation |
| 3-4 | Comprehensive Validation | Business rules | Complete validation system |
| 4-5 | Enhanced UI | User interface | Real-time validation modal |
| 5-6 | Calendar Integration | Calendar operations | Multi-calendar support |
| 6-7 | Migration & Training | Deployment | Full system operational |

---

## **🔧 Technical Implementation Notes**

### **Key Functions to Create**
1. `getAvailableTeachers(dateTime, duration)`
2. `checkTeacherAvailability(dateTime, duration, lessonType)`
3. `assignTeacherToLesson(dateTime, duration, lessonType)`
4. `getStudentType(student)`
5. `validateStudentTypeCompatibility(lessonData, existingLessons)`
6. `validateLessonScheduling(lessonData)`
7. `createLessonEvent(lessonData)`
8. `getCalendarForStudent(student)`
9. `logLessonAction(actionData)`

### **Key Configuration Objects**
1. `TEACHER_CONFIG` - Teacher management
2. `CALENDAR_CONFIG` - Multi-calendar support
3. `VALIDATION_RULES` - Business rules

### **Key UI Components**
1. Enhanced scheduling modal
2. Real-time validation display
3. Student type indicators
4. Teacher availability indicators
5. Status badges

---

**This roadmap provides a clear path from the current manual calendar system to a fully automated, validated lesson scheduling system that enforces all business rules while providing an excellent user experience.** 🎉
