# GreenSquare Student Administration System

A comprehensive web-based student management system built with Google Apps Script, designed for language schools and educational institutions. This system provides complete student lifecycle management including registration, payment tracking, lesson scheduling, and communication.

## 🌟 Features

### Core Functionality
- **Student Management**: Add, edit, delete, and search student records
- **Payment Tracking**: Comprehensive payment logging with transaction history
- **Lesson Scheduling**: Integration with Google Calendar for lesson management
- **Notes System**: Detailed student notes and communication logs
- **Dashboard Analytics**: Real-time statistics and reporting
- **Multi-language Support**: Japanese and English interface support

### Advanced Features
- **Google Contacts Integration**: Automatic contact creation and management
- **Payment Calculations**: Automated fee calculations based on lesson types
- **Cancellation Tracking**: Special handling for same-day cancellations (当日キャンセル)
- **Data Migration Tools**: Batch migration utilities for legacy data
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## 🏗️ Architecture

### Technology Stack
- **Backend**: Google Apps Script (JavaScript)
- **Frontend**: HTML5, CSS3, Tailwind CSS
- **Icons**: Lucide Icons
- **Data Storage**: Google Sheets
- **Calendar Integration**: Google Calendar API
- **Contact Management**: Google People API

### Project Structure

```
Student-Admin-Workaround/
├── Code.js                    # Main Google Apps Script backend (2159 lines)
├── Index.html                 # Primary web interface (1914 lines)
├── Students.html              # Student list view components
├── ListScripts.html           # List view functionality and search
├── HelperFunctions.html       # Utility functions and helpers
├── Styles.html                # CSS styles and theming
├── appsscript.json            # Google Apps Script configuration
├── .clasp.json               # CLASP deployment configuration
├── README.md                  # Project documentation
├── TODO.md                    # Development tasks and roadmap
├── PROMPT.md                  # Development setup guide
└── .gitignore                 # Git ignore rules
```

## 📊 Data Model

### Core Entities

#### Students
- **ID**: Unique student identifier
- **FirstName/LastName**: Student name
- **漢字**: Japanese kanji name
- **子**: Child indicator (TRUE) - shows "子" only for child students, empty for adults
- **Email**: Contact email
- **Phone**: Primary phone number
- **phone (secondary)**: Secondary contact
- **当日 Cancellation**: Same-day cancellation status (済/未)
- **Status**: Active/Dormant/DEMO status
- **Payment**: Payment type (NEO/OLD)
- **Group**: Lesson group type (Individual/Group)
- **人数**: Number of people in group

#### Payments
- **Transaction ID**: Unique payment identifier
- **Student ID**: Reference to student
- **Year/Month**: Payment period
- **Amount**: Payment amount
- **Discount**: Applied discounts
- **Total**: Final amount
- **Date**: Payment date
- **Method**: Payment method
- **Staff**: Staff member who processed payment

#### Notes
- **ID**: Unique note identifier
- **Student ID**: Reference to student
- **Date**: Note date
- **Note**: Note content
- **Staff**: Staff member who created note

#### Lessons
- **Calendar Integration**: Google Calendar events
- **Student Tracking**: Lesson attendance and scheduling
- **Monthly Tallying**: Automated lesson counting

## 🚀 Setup and Deployment

### Prerequisites
- Google Workspace account
- Google Apps Script access
- Google Sheets for data storage
- Google Calendar for lesson scheduling

### Installation

1. **Clone the Repository**
   ```bash
   git clone [repository-url]
   cd "Student-Admin-Workaround"
   ```

2. **Configure Google Apps Script**
   - Open [Google Apps Script](https://script.google.com)
   - Create a new project
   - Copy the script ID from `.clasp.json`
   - Deploy as a web app

3. **Set Up Google Sheets**
   - Create a new Google Sheet
   - Create sheets: `Students`, `Payment`, `Notes`, `Lessons`, `PaymentLogs`
   - Update the `SS_ID` in `Code.js` with your sheet ID

4. **Configure APIs**
   - Enable Google Sheets API
   - Enable Google Calendar API
   - Enable Google People API

5. **Deploy with CLASP**
   ```bash
   npm install -g @google/clasp
   clasp login
   clasp push
   ```

### Configuration

#### Spreadsheet Setup
The system requires the following sheets in your Google Spreadsheet:

- **Students**: Student master data
- **Payment**: Payment records
- **Notes**: Student notes and communications
- **Lessons**: Lesson tracking
- **PaymentLogs**: Payment history
- **当日キャンセル**: Same-day cancellations

#### Calendar Integration
- Set up Google Calendar for lesson scheduling
- Update `LESSON_CALENDAR_ID` in `Code.js`
- Configure calendar permissions

## 📱 Usage

### Student Management
1. **Add Student**: Click "Add Student" button
2. **Edit Student**: Click edit icon in student list
3. **View Details**: Click student name for detailed view
4. **Delete Student**: Use delete button in details modal

### Payment Management
1. **Add Payment**: Use payment modal in student details
2. **View Payments**: Access payment logs from sidebar
3. **Payment History**: View complete payment history per student

### Notes System
1. **Add Notes**: Use notes modal in student details
2. **View Notes**: All notes displayed in student details
3. **Search Notes**: Use search functionality

### Dashboard
- **Real-time Stats**: Current student count, payments, lessons
- **Analytics**: Monthly payment summaries
- **Quick Actions**: Add students, view payments

## 🔧 Customization

### Styling
- Modify `Styles.html` for custom theming
- Update color scheme in CSS variables
- Customize Tailwind components

### Functionality
- Add new fields in `Code.js` functions
- Extend payment calculations
- Modify lesson tracking logic

### Localization
- Update Japanese text in HTML files
- Modify date/time formats
- Add additional language support

## 🛠️ Development

### Code Organization
- **Backend Logic**: `Code.js` contains all server-side functions
- **Frontend**: HTML files contain UI components
- **Scripts**: JavaScript files handle client-side interactions
- **Styles**: CSS in `Styles.html` for theming

### Key Functions

#### Student Management
- `getStudents()`: Retrieve all students
- `addStudent(student)`: Add new student
- `updateStudent(student)`: Update existing student
- `deleteStudent(id)`: Delete student

#### Payment Processing
- `insertPayment(pay)`: Add payment record
- `getAllPayments()`: Retrieve payment history
- `calculateFee()`: Calculate lesson fees

#### Lesson Tracking
- `getLessonEventsForMonth()`: Get calendar events
- `tallyLessonsForMonthAndStore()`: Count lessons
- `updateScheduledLessonsForStudent()`: Update lesson records

### Current Development Status

#### Completed Features ✅
- Basic student CRUD operations
- Payment tracking system
- Google Contacts integration
- Calendar integration
- Modern UI with Tailwind CSS
- Search and filtering functionality

#### In Progress ⏳
- Performance optimization (excessive logging removal)
- Spreadsheet caching implementation
- Code modularization
- Error handling improvements

#### Planned Features 📋
- Advanced dashboard analytics
- Data validation system
- User management and permissions
- Mobile responsiveness improvements
- Comprehensive testing suite

## 📈 Analytics and Reporting

### Dashboard Features
- **Student Statistics**: Total active/dormant students
- **Payment Analytics**: Monthly payment summaries
- **Lesson Tracking**: Scheduled vs. completed lessons
- **Revenue Reports**: Payment trends and totals

### Data Export
- Export student lists to CSV
- Generate payment reports
- Lesson attendance reports

## 🔒 Security and Permissions

### Access Control
- User-based access (execute as deploying user)
- Private access (myself only)
- Secure API key management

### Data Protection
- Google's built-in security
- Encrypted data transmission
- Audit logging available

## 🐛 Troubleshooting

### Common Issues
1. **Script Errors**: Check Google Apps Script logs
2. **Permission Issues**: Verify API access
3. **Data Sync**: Refresh browser cache
4. **Calendar Issues**: Check calendar permissions
5. **Empty Table Columns**: If columns like "子" appear empty, this is normal - the "子" column only shows "子" for child students, and is empty for adult students
6. **Z-Index Conflicts**: If modal elements appear behind other content, check CSS z-index values and stacking context
7. **Table Layout Issues**: If table doesn't take full screen height, verify flexbox CSS classes are properly applied

### Debug Mode
- Enable detailed logging in `Code.js`
- Check browser console for errors
- Verify spreadsheet permissions

## 📝 License

This project is proprietary software for GreenSquare language school. All rights reserved.

## 🤝 Contributing

For internal development:
1. Create feature branch
2. Test thoroughly
3. Update documentation
4. Submit pull request

## 📞 Support

For technical support or questions:
- Check Google Apps Script documentation
- Review system logs
- Contact development team

---

**Version**: 1.0.0.16  
**Last Updated**: 2024-12-19  
**Maintained by**: GreenSquare Development Team 