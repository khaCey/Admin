// ─── CONFIGURATION (from user's source) ────────────────────────────────────────
var SS_ID               = '1upKC-iNWs7HIeKiVVAegve5O5WbNebbjMlveMcvnuow';
var STUDENT_SHEET       = 'Students';
var PAYMENT_SHEET       = 'Payment';
var NOTES_SHEET         = 'Notes';
var LESSON_SHEET        = 'Lessons';
var OWNERS_COURSE_CAL_ID = 'c_403306dccf2039f61a620a4cfc22424c5a6f79e945054e57f30ecc50c90b9207@group.calendar.google.com';
var LESSON_CALENDAR_ID  = 'greensquare.jp_h8u0oufn8feana384v67o46o78@group.calendar.google.com';

// Fee table definition
var feeTable = {
  'OLD': {
    'Single': {
      '2x': 4620,  // 2 lessons per month
      '4x': 4400,  // 4 lessons per month
      '8x': 3960   // 8 lessons per month
    },
    'Group': {
      2: {
        '2x': 2860,
        '4x': 2750,
        '8x': 2530
      },
      3: {
        '2x': 2273,
        '4x': 2200,
        '8x': 2053
      },
      4: {
        '2x': 1980,
        '4x': 1925,
        '8x': 1815
      }
    },
    'Pronunciation': 7700
  },
  'Neo': {
    'Single': {
      '2x': 7150,
      '4x': 5720,
      '8x': 4950
    },
    'Group': {
      2: {
        '2x': 4675,
        '4x': 3960,
        '8x': 3575
      },
      3: {
        '2x': 3850,
        '4x': 3373,
        '8x': 3117
      },
      4: {
        '2x': 3438,
        '4x': 3080,
        '8x': 2888
      }
    }
  },
  'Owner\'s Lesson': 9350  // Flat rate per lesson, regardless of group or frequency
};

// Feature flags configuration - toggle components on/off
var FEATURE_FLAGS = {
  notifications: { enabled: false, description: 'Notification system' },
  unpaidStudents: { enabled: true, description: 'Unpaid students button' },
  unscheduledLessons: { enabled: true, description: 'Unscheduled lessons button' },
  codePage: { enabled: true, description: 'Code management page' },
  lessonBooking: { enabled: true, description: 'Lesson booking calendar' },
  lessonActions: { enabled: true, description: 'Cancel/Reschedule/Remove lesson actions' }
};
// ─── END CONFIGURATION ─────────────────────────────────────────────────────────

function doGet(){return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('Student Admin - Green Square');}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getStudents() {
  var sh = SpreadsheetApp.openById(SS_ID).getSheetByName(STUDENT_SHEET);
  return sh.getDataRange().getDisplayValues();
}

function getStudentById(id) {
  var data = getStudents(), headers = data[0], idx = headers.indexOf('ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(id)) {
      var obj = {};
      headers.forEach(function(h,j){ obj[h] = data[i][j]; });
      return obj;
    }
  }
  return null;
}

function getAllPayments() {
    var sh = SpreadsheetApp.openById(SS_ID).getSheetByName('Payment');
    var data = sh.getDataRange().getValues();
    // Return headers and rows exactly as in the sheet
    return data;
  }

function addStudent(student) {
  Logger.log('[addStudent] Input student: ' + JSON.stringify(student));
  var sh      = SpreadsheetApp.openById(SS_ID).getSheetByName(STUDENT_SHEET),
      headers = sh.getDataRange().getValues()[0],
      ids     = sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat(),
      nextId  = ids.length ? Math.max.apply(null, ids)+1 : 1,
      row     = headers.map(function(h){
        return h==='ID' ? nextId : (student[h]||'');
      });
  Logger.log('[addStudent] Row to append: ' + JSON.stringify(row));
  sh.appendRow(row);

  // Create Google Contact for new student
  try {
    createOrUpdateGoogleContactForStudent(student);
  } catch (e) {
    Logger.log('Error creating Google Contact: ' + e.message);
  }

  return nextId;
}

function updateStudent(student) {
  // Debug logging
  Logger.log('updateStudent called with: ' + JSON.stringify(student));
  
  var sh      = SpreadsheetApp.openById(SS_ID).getSheetByName(STUDENT_SHEET),
      values  = sh.getDataRange().getValues(),
      headers = values[0],
      idx     = headers.indexOf('ID');

  Logger.log('Headers: ' + JSON.stringify(headers));
  Logger.log('Looking for student ID: ' + student.ID);

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idx]) === String(student.ID)) {
      Logger.log('Found student at row: ' + (i+1));
      
      // Get the old email before updating
      var oldEmail = null;
      var emailCol = headers.indexOf('email');
      if (emailCol !== -1) {
        oldEmail = values[i][emailCol];
      }
      
      // Only update fields that are actually provided in the student object
      for (var key in student) {
        if (student.hasOwnProperty(key) && key !== 'ID') {
          var colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            Logger.log('Updating column ' + key + ' (index ' + colIndex + ') with value: ' + student[key]);
            sh.getRange(i+1, colIndex+1).setValue(student[key] || '');
          } else {
            Logger.log('Column ' + key + ' not found in headers');
          }
        }
      }
      
      // Update Google Contact for student, passing oldEmail if changed
      try {
        createOrUpdateGoogleContactForStudent(student, oldEmail);
      } catch (e) {
        Logger.log('Error updating Google Contact: ' + e.message);
      }
      Logger.log('Student update completed successfully');
      return true;
    }
  }
  Logger.log('Student with ID ' + student.ID + ' not found');
  return false;
}



function createOrUpdateGoogleContactForStudent(student, oldEmail) {
  Logger.log('createOrUpdateGoogleContactForStudent called with student: ' + JSON.stringify(student) + ', oldEmail: ' + oldEmail);
  
  // Handle both Name field (from frontend) and FirstName/LastName fields
  const fullName = student.Name || '';
  const firstName = student.FirstName || '';
  const lastName = student.LastName || '';
  
  if (!fullName && !firstName && !lastName) {
    Logger.log('No name provided, skipping contact creation');
    return;
  }
  
  const people = People.People;
  
  // Parse name if we have a full name but no first/last
  let finalFirstName = firstName;
  let finalLastName = lastName;
  
  if (fullName && !firstName && !lastName) {
    const nameParts = fullName.trim().split(' ');
    finalFirstName = nameParts[0] || '';
    finalLastName = nameParts.slice(1).join(' ') || '';
  }
  const finalFullName = (finalFirstName + ' ' + finalLastName).trim();
  const email      = student.Email || student.email || '';
  const phone      = student.Phone || student.phone || '';
  const phone2     = student['phone (secondary)'] || '';
  const kanji      = student['漢字']     || '';
  const status     = student.Status     || 'Dormant';

  // Use correct resource names for contact groups
  let groupResourceName;
  if (status === 'Active') {
    groupResourceName = 'contactGroups/755ae13f8c97ace8'; // Active Student
  } else { // DEMO and Dormant both map to Dormant Student
    groupResourceName = 'contactGroups/25857bc10a9c8675'; // Dormant Student
  }

  // --- find existing resourceName ---
  let resourceName = null;
  let foundBy = null;
  function normalizeEmail(e) {
    return (e || '').toLowerCase().trim();
  }
  // 1. Try to find by old email (if provided and different from new email)
  if (oldEmail && normalizeEmail(oldEmail) !== normalizeEmail(email)) {
    const resp = people.Connections.list('people/me', {
      personFields: 'emailAddresses,metadata',
      pageSize: 2000
    });
    (resp.connections || []).some(p => {
      const isContact = (p.metadata && p.metadata.sources || []).some(
        s => s.type === 'CONTACT'
      );
      if (!isContact) return false;
      if ((p.emailAddresses || []).some(e => normalizeEmail(e.value) === normalizeEmail(oldEmail))) {
        resourceName = p.resourceName;
        foundBy = 'oldEmail';
        return true;
      }
    });
  }
  // 2. Try to find by new email
  if (!resourceName && email) {
    const resp = people.Connections.list('people/me', {
      personFields: 'emailAddresses,metadata',
      pageSize: 2000
    });
    (resp.connections || []).some(p => {
      const isContact = (p.metadata && p.metadata.sources || []).some(
        s => s.type === 'CONTACT'
      );
      if (!isContact) return false;
      if ((p.emailAddresses || []).some(e => normalizeEmail(e.value) === normalizeEmail(email))) {
        resourceName = p.resourceName;
        foundBy = 'email';
        return true;
      }
    });
  }
  // 3. Try to find by full name
  if (!resourceName) {
    const resp2 = people.Connections.list('people/me', {
      personFields: 'names,metadata',
      pageSize: 2000
    });
    (resp2.connections || []).some(p => {
      const isContact = (p.metadata && p.metadata.sources || []).some(
        s => s.type === 'CONTACT'
      );
      if (!isContact) return false;
      if ((p.names || []).some(n => (n.displayName || '').trim() === finalFullName)) {
        resourceName = p.resourceName;
        foundBy = 'name';
        return true;
      }
    });
  }

  // --- build the Person payload ---
  const personPayload = {
    names: [{ givenName: finalFirstName, familyName: finalLastName }],
    emailAddresses: email ? [{ value: email, type: 'work' }] : [],
    phoneNumbers: [],
    biographies: kanji ? [{ value: 'Kanji: ' + kanji, contentType: 'TEXT_PLAIN' }] : [],
    memberships: [{
      contactGroupMembership: {
        contactGroupResourceName: groupResourceName
      }
    }]
  };
  if (phone)  personPayload.phoneNumbers.push({ value: phone,  type: 'mobile' });
  if (phone2) personPayload.phoneNumbers.push({ value: phone2, type: 'mobile' });

  Logger.log('Google Contact Payload: ' + JSON.stringify(personPayload));
  Logger.log('Contact lookup result: ' + (resourceName ? ('Found by ' + foundBy + ': ' + resourceName) : 'No match, will create new contact'));

  // --- call the People API ---
  try {
    if (resourceName) {
      Logger.log('Updating existing Google Contact: ' + resourceName);
      const result = people.updateContact(
        resourceName,
        personPayload,
        { updatePersonFields: 'names,emailAddresses,phoneNumbers,biographies,memberships' }
      );
      Logger.log('Google Contact updated successfully: ' + JSON.stringify(result));
    } else {
      Logger.log('Creating new Google Contact');
      const result = people.createContact(personPayload);
      Logger.log('Google Contact created successfully: ' + JSON.stringify(result));
    }
  } catch (e) {
    Logger.log('Error creating/updating Google Contact: ' + e.message + '\nPayload: ' + JSON.stringify(personPayload) + '\nresourceName: ' + resourceName);
    throw e;
  }
}

function deleteGoogleContactForStudent(student) {
  Logger.log('deleteGoogleContactForStudent called with student: ' + JSON.stringify(student));
  
  if (!student.Name && !student.FirstName && !student.LastName) {
    Logger.log('No name provided, skipping contact deletion');
    return;
  }
  
  const people = People.People;
  
  // Handle both Name field (from frontend) and FirstName/LastName fields
  const fullName = student.Name || '';
  const firstName = student.FirstName || '';
  const lastName = student.LastName || '';
  const email = student.Email || student.email || '';
  
  // Parse name if we have a full name but no first/last
  let finalFirstName = firstName;
  let finalLastName = lastName;
  
  if (fullName && !firstName && !lastName) {
    const nameParts = fullName.trim().split(' ');
    finalFirstName = nameParts[0] || '';
    finalLastName = nameParts.slice(1).join(' ') || '';
  }
  
  const finalFullName = (finalFirstName + ' ' + finalLastName).trim();
  
  function normalizeEmail(e) {
    return (e || '').toLowerCase().trim();
  }
  
  // Find the contact to delete
  let resourceName = null;
  
  // 1. Try to find by email
  if (email) {
    const resp = people.Connections.list('people/me', {
      personFields: 'emailAddresses,metadata',
      pageSize: 2000
    });
    (resp.connections || []).some(p => {
      const isContact = (p.metadata && p.metadata.sources || []).some(
        s => s.type === 'CONTACT'
      );
      if (!isContact) return false;
      if ((p.emailAddresses || []).some(e => normalizeEmail(e.value) === normalizeEmail(email))) {
        resourceName = p.resourceName;
        return true;
      }
    });
  }
  
  // 2. Try to find by full name if not found by email
  if (!resourceName && finalFullName) {
    const resp2 = people.Connections.list('people/me', {
      personFields: 'names,metadata',
      pageSize: 2000
    });
    (resp2.connections || []).some(p => {
      const isContact = (p.metadata && p.metadata.sources || []).some(
        s => s.type === 'CONTACT'
      );
      if (!isContact) return false;
      if ((p.names || []).some(n => (n.displayName || '').trim() === finalFullName)) {
        resourceName = p.resourceName;
        return true;
      }
    });
  }
  
  if (resourceName) {
    try {
      Logger.log('Deleting Google Contact: ' + resourceName);
      people.deleteContact(resourceName);
      Logger.log('Google Contact deleted successfully: ' + resourceName);
    } catch (e) {
      Logger.log('Error deleting Google Contact: ' + e.message + '\nresourceName: ' + resourceName);
      throw e;
    }
  } else {
    Logger.log('No matching Google Contact found to delete');
  }
}

function deleteStudent(id) {
  Logger.log('deleteStudent called with ID: ' + id);
  
  var sh      = SpreadsheetApp.openById(SS_ID).getSheetByName(STUDENT_SHEET),
      values  = sh.getDataRange().getValues(),
      headers = values[0],
      idx     = headers.indexOf('ID');
      
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idx]) === String(id)) {
      // Get student data before deleting for Google Contact deletion
      var studentData = {};
      headers.forEach(function(header, index) {
        studentData[header] = values[i][index];
      });
      
      Logger.log('Student data to delete: ' + JSON.stringify(studentData));
      
      // Delete Google Contact if it exists
      try {
        deleteGoogleContactForStudent(studentData);
      } catch (e) {
        Logger.log('Error deleting Google Contact: ' + e.message);
        // Don't fail the entire operation if contact deletion fails
      }
      
      // Delete the row from spreadsheet
      sh.deleteRow(i+1);
      Logger.log('Student row deleted successfully');
      return true;
    }
  }
  Logger.log('Student not found with ID: ' + id);
  return false;
}

function getStudentDetails(id) {
  var ss     = SpreadsheetApp.openById(SS_ID),
      result = { student: getStudentById(id), payments: [], notes: [] };

  // Get student info first
  var student = getStudentById(id);
  if (!student) {
    Logger.log('No student found for ID: ' + id);
    return result;
  }

  // Payments - load ALL payments for this student
  try {
    var psh = ss.getSheetByName(PAYMENT_SHEET);
    if (psh) {
      var pdata = psh.getDataRange().getDisplayValues();
      var pheaders = pdata.shift();
      // Trim headers to remove any whitespace issues
      var pheadersTrimmed = pheaders.map(function(h) { return String(h || '').trim(); });
      var pidIdx = pheadersTrimmed.indexOf('Student ID');
      
      // Also find Transaction ID index for logging
      var txnIdIdx = pheadersTrimmed.indexOf('Transaction ID');
      
      if (txnIdIdx === -1) {
        Logger.log('⚠️ Warning: Transaction ID column not found in Payment sheet headers. Headers: ' + JSON.stringify(pheadersTrimmed));
      }
      
      var paymentCount = 0;
      pdata.forEach(function(r){
        if (String(r[pidIdx]) === String(id)) {
          paymentCount++;
          var obj = {};
          // Build object using original headers array to ensure correct column mapping
          pheaders.forEach(function(h, j) {
            var hTrimmed = String(h || '').trim();
            var value = r[j] || '';
            // Set with both trimmed and original header names
            obj[hTrimmed] = value;
            if (h.trim() !== hTrimmed) {
              obj[h] = value;
            }
          });
          
          // Log the payment object to debug Transaction ID
          
          result.payments.push(obj);
        }
      });
    }
  } catch (error) {
    Logger.log('Error loading payments: ' + error.toString());
  }

  // Notes - load ALL notes for this student
  try {
    var nsh = ss.getSheetByName(NOTES_SHEET);
    if (nsh) {
      var ndata = nsh.getDataRange().getDisplayValues();
      var nheaders = ndata.shift();
      var nidIdx = nheaders.indexOf('StudentID');
      
      ndata.forEach(function(r){
        if (String(r[nidIdx]) === String(id)) {
          var obj = {};
          nheaders.forEach(function(h,j){ obj[h] = r[j]; });
          result.notes.push(obj);
        }
      });
    }
  } catch (error) {
    Logger.log('Error loading notes: ' + error.toString());
  }

  // Latest record data - get student name first
  var studentName = student.Name || student.name || student['Student Name'] || '';
  if (studentName) {
    try {
      var latestRecordData = getLatestRecordData(studentName, id);
      result.latestByMonth = latestRecordData.latestByMonth || {};
    } catch (error) {
      Logger.log('Error getting latest record data: ' + error.toString());
      result.latestByMonth = {};
    }
  } else {
    result.latestByMonth = {};
  }

  return result;
}

function getLatestByMonth(id) {
  var ss      = SpreadsheetApp.openById(SS_ID),
      sh      = ss.getSheetByName(LESSON_SHEET),
      values  = sh.getDataRange().getDisplayValues(),
      headers = values.shift(),
      idx     = {
        id:    headers.indexOf('Student ID'),
        month: headers.indexOf('Month'),
        pay:   headers.indexOf('Payment'),
        sch:   headers.indexOf('Schedule'),
        bkd:   headers.indexOf('Booked'),
        schd:  headers.indexOf('Scheduled')
      },
      tz       = Session.getScriptTimeZone(),
      today    = new Date(),
      thisStr  = Utilities.formatDate(today, tz, 'MMMM yyyy'),
      nextDate = new Date(today.getFullYear(), today.getMonth()+1, 1),
      nextStr  = Utilities.formatDate(nextDate, tz, 'MMMM yyyy'),
      thisRec  = null,
      nextRec  = null;

  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    if (String(r[idx.id]) !== String(id)) continue;
    if (!thisRec && r[idx.month] === thisStr) {
      thisRec = {
        Payment:   r[idx.pay],
        Schedule:  r[idx.sch],
        Booked:    r[idx.bkd],
        Scheduled: r[idx.schd]
      };
    }
    if (!nextRec && r[idx.month] === nextStr) {
      nextRec = {
        Payment:   r[idx.pay],
        Schedule:  r[idx.sch],
        Booked:    r[idx.bkd],
        Scheduled: r[idx.schd]
      };
    }
    if (thisRec && nextRec) break;
  }
  return { thisRec: thisRec, nextRec: nextRec };
}

function updateNote(note) {
  Logger.log('📝 Updating note: ' + JSON.stringify(note));
  
  var ss      = SpreadsheetApp.openById(SS_ID),
      sh      = ss.getSheetByName(NOTES_SHEET),
      headers = sh.getDataRange().getValues()[0],
      idCol   = headers.indexOf('ID') + 1; // +1 for 1-based column index
  
  Logger.log('🔍 Looking for note with ID: ' + note['ID']);
  Logger.log('🔢 ID column: ' + idCol);
  
  // Use findText for efficient search
  var range = sh.getRange(1, idCol, sh.getLastRow(), 1);
  var searchResult = range.createTextFinder(note['ID']).findNext();
  
  if (searchResult) {
    var rowNum = searchResult.getRow();
    Logger.log('✅ Found matching note at row ' + rowNum + ', updating...');
    
    // Update all columns except ID
    headers.forEach(function(h, j) {
      if (h !== 'ID') {
        var newValue = note[h] || '';
        Logger.log('📝 Setting ' + h + ' = ' + newValue + ' at position (' + rowNum + ',' + (j+1) + ')');
        sh.getRange(rowNum, j+1).setValue(newValue);
      }
    });
    Logger.log('✅ Note updated successfully');
    return true;
  } else {
    Logger.log('❌ Note with ID ' + note['ID'] + ' not found in sheet');
    return false;
  }
}

function updatePayment(pay) {
  var ss      = SpreadsheetApp.openById(SS_ID),
      sh      = ss.getSheetByName('Payment'),
      data    = sh.getDataRange().getDisplayValues(),
      headers = data[0],
      headersTrimmed = headers.map(function(h) { return String(h || '').trim(); }),
      idx     = headersTrimmed.indexOf('Transaction ID');
  
  if (idx === -1) {
    Logger.log('⚠️ Warning: Transaction ID column not found in Payment sheet headers. Headers: ' + JSON.stringify(headersTrimmed));
    return false;
  }
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(pay['Transaction ID'])) {
      headersTrimmed.forEach(function(h,j){
        if (h !== 'Transaction ID') {
          // Try to get value using both original and trimmed header names
          var value = pay[h] || pay[headers[j]] || '';
          sh.getRange(i+1,j+1).setValue(value);
        }
      });
      return true;
    }
  }
  return false;
}

function saveMonthlyRecord(record) {
  var ss      = SpreadsheetApp.openById(SS_ID);
  var sh      = ss.getSheetByName(LESSON_SHEET);
  var allData = sh.getDataRange().getValues();     // real Date objects for date-formatted cells
  var headers = allData.shift();                   // first row = headers
  var rows    = allData;                           // the rest

  // 0) Compute recDate from YYYY-MM
  var parts    = record.Month.split('-');
  var year     = parseInt(parts[0], 10);
  var monthNum = parseInt(parts[1], 10) - 1;
  var recDate  = new Date(year, monthNum, 1);
  var tz       = ss.getSpreadsheetTimeZone();
  var monthText = Utilities.formatDate(recDate, tz, 'MMMM yyyy');

  // 1) Find column indices
  var sidIdx   = headers.indexOf('Student ID');
  var monIdx   = headers.indexOf('Month');
  var payIdx   = headers.indexOf('Payment');
  var schIdx   = headers.indexOf('Schedule');
  var bkdIdx   = headers.indexOf('Booked');
  var scdCntIdx= headers.indexOf('ScheduledCount');
  var scdIdx   = headers.indexOf('Scheduled');

  // 2) Locate existing row
  var foundRow = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][sidIdx]) !== String(record['Student ID'])) continue;
    var cell = rows[i][monIdx];
    var match = false;
    if (cell instanceof Date) {
      match = cell.getFullYear()===year && cell.getMonth()===monthNum;
    } else {
      match = String(cell).trim() === monthText;
    }
    if (match) {
      foundRow = i + 2;  // account for header + 1-based
      break;
    }
  }

  if (foundRow !== -1) {
    // 4a) Update existing
    headers.forEach(function(h, j) {
      if (h==='Student ID') return;
      var val;
      switch (h) {
        case 'Month':           val = monthText; break;
        case 'Payment':         val = record.Payment; break;
        case 'Schedule':        val = record.Schedule; break;
        case 'Booked':          val = record.Lessons; break;
        case 'ScheduledCount':  val = record.ScheduledCount; break;
        case 'Scheduled':       val = record.Scheduled; break;
        case 'Total':           val = record.Total; break;
        case 'Method':          val = record.Method; break;
        case 'Staff':           val = record.Staff; break;
        default:                val = record[h] || '';
      }
      sh.getRange(foundRow, j+1).setValue(val);
    });
  } else {
    // 4b) Append new row
    var newRow = headers.map(function(h) {
      switch (h) {
        case 'Student ID':      return record['Student ID'];
        case 'Month':           return monthText;
        case 'Payment':         return record.Payment;
        case 'Schedule':        return record.Schedule;
        case 'Booked':          return record.Lessons;
        case 'ScheduledCount':  return record.ScheduledCount;
        case 'Scheduled':       return record.Scheduled;
        case 'Total':           return record.Total;
        case 'Method':          return record.Method;
        case 'Staff':           return record.Staff;
        default:                return '';
      }
    });
    sh.appendRow(newRow);
  }
}

function getCurrentStaffName() {
  var ss = SpreadsheetApp.openById(SS_ID);
  return ss.getSheetByName('Code').getRange('B1').getValue();
}

function getStaffName() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var codeSheet = ss.getSheetByName('Code');
    if (codeSheet) {
      var staffName = codeSheet.getRange('B1').getValue();
      return staffName || '';
    }
  } catch (error) {
    Logger.log('Error getting staff name: ' + error.toString());
  }
  return '';
}

function getScheduledLessonsCount(studentID) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var lessonSheet = ss.getSheetByName(LESSON_SHEET);
    if (!lessonSheet) return 0;
    
    var data = lessonSheet.getDataRange().getValues();
    var headers = data[0];
    var studentIdIdx = headers.indexOf('Student ID');
    var scheduledIdx = headers.indexOf('Scheduled');
    var monthIdx = headers.indexOf('Month');
    
    if (studentIdIdx === -1 || scheduledIdx === -1) return 0;
    
    var tz = Session.getScriptTimeZone();
    var today = new Date();
    var currentMonth = Utilities.formatDate(today, tz, 'MMMM yyyy');
    
    var totalScheduled = 0;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[studentIdIdx]) === String(studentID) && 
          String(row[monthIdx]) === currentMonth) {
        totalScheduled += Number(row[scheduledIdx]) || 0;
      }
    }
    
    return totalScheduled;
  } catch (error) {
    Logger.log('Error getting scheduled lessons count: ' + error.toString());
  }
  return 0;
}

function addNote(note) {
  Logger.log('📝 Adding note: ' + JSON.stringify(note));

  var ss      = SpreadsheetApp.openById(SS_ID);
  var sh      = ss.getSheetByName(NOTES_SHEET);
  var headers = sh.getDataRange().getValues()[0];

  var newRow = headers.map(function(h) {
    return note[h] || '';
  });

  Logger.log('🧾 Final Row: ' + JSON.stringify(newRow));

  sh.appendRow(newRow);
  return true;
}

function normalizeString(v) {
  return v ? v.toString().trim().toLowerCase() : null;
}

function capitalize(v) {
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function getRate(rates, lessons) {
  for (let [threshold, price] of rates) {
    if (lessons <= threshold) {
      return lessons * price;
    }
  }
  // if beyond all thresholds, use the highest bracket
  const highest = rates[rates.length - 1][1];
  return lessons * highest;
}

function getRateFromFrequency(rates, lessons) {
  // Determine frequency based on number of lessons
  let frequency;
  if (lessons <= 3) {
    frequency = '2x';
  } else if (lessons <= 7) {
    frequency = '4x';
  } else {
    // For 8+ lessons, use the 8x rate
    frequency = '8x';
  }
  
  Logger.log('🔍 getRateFromFrequency - lessons: ' + lessons + ', frequency: ' + frequency);
  Logger.log('🔍 Available rates: ' + JSON.stringify(rates));
  
  const rate = rates[frequency];
  if (!rate) {
    throw new Error('Rate not found for frequency: ' + frequency);
  }
  
  Logger.log('🔍 Selected rate: ' + rate + ', total: ' + (lessons * rate));
  return lessons * rate;
}

function calculateFee(lessonType, feeType, groupSize, lessons) {
  Logger.log('🔍 calculateFee called with: lessonType=' + lessonType + ', feeType=' + feeType + ', groupSize=' + groupSize + ', lessons=' + lessons);
  
  // Check if feeTable exists
  if (!feeTable) {
    throw new Error('Fee table is not defined');
  }
  
  // Check if feeType exists in feeTable
  if (!feeTable[feeType]) {
    throw new Error('Invalid fee type: ' + feeType);
  }

  // Flat Owner's Lesson payment type - flat rate of 9350 per lesson
  if (feeType === "Owner's Lesson" || feeType === "Owners Lesson") {
    return lessons * feeTable['Owner\'s Lesson'];
  }

  // Flat Pronunciation (only for OLD payment type)
  if (feeType === "Pronunciation") {
    return lessons * feeTable[feeType].Pronunciation;
  }

  // Private (Single) lessons
  if (lessonType === "Single") {
    const rates = feeTable[feeType].Single;
    if (!rates) {
      throw new Error('Single rates not found for fee type: ' + feeType);
    }
    Logger.log('🔍 Using Single rates for ' + feeType + ': ' + JSON.stringify(rates));
    return getRateFromFrequency(rates, lessons);
  }

  // Group lessons
  const groupRates = feeTable[feeType].Group[groupSize];
  if (!groupRates) {
    throw new Error("Invalid group size: " + groupSize + " for fee type: " + feeType);
  }
  Logger.log('🔍 Using Group rates for ' + feeType + ' size ' + groupSize + ': ' + JSON.stringify(groupRates));
  return getRateFromFrequency(groupRates, lessons);
}

function getTotalFeeForStudent(studentID, lessons) {
  Logger.log('🔍 getTotalFeeForStudent: studentID=%s, lessons=%s', studentID, lessons);

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sh    = ss.getSheetByName(STUDENT_SHEET);
  const values  = sh.getDataRange().getDisplayValues();
  const heads = values.shift();


  // Find column indices
  const idCol    = heads.indexOf('ID');
  const typeCol  = heads.indexOf('Payment');  // Updated from 'Type' to 'Payment Type'
  const groupCol = heads.indexOf('Group');
  const sizeCol  = heads.indexOf('人数');

  // Locate the student row
  let rawFeeType, rawLessonType, groupSize;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][idCol]) === String(studentID)) {
      rawFeeType      = values[i][typeCol];
      rawLessonType   = values[i][groupCol];
      groupSize       = Number(values[i][sizeCol]) || 0;
      break;
    }
  }
  if (!rawFeeType) {
    throw new Error('Student ID ' + studentID + ' not found in Students sheet.');
  }

  // Normalize to match feeTable keys:
  //   OLD  → OLD
  //   NEO  → Neo
  //   Owner's Lesson → Owner's Lesson
  let feeTypeKey;
  const norm = rawFeeType ? rawFeeType.trim().toLowerCase() : '';
  if (norm === 'old') feeTypeKey = 'OLD';
  else if (norm === 'neo') feeTypeKey = 'Neo';
  else if (norm === "owner's lesson" || norm === "owners lesson") feeTypeKey = "Owner's Lesson";
  else feeTypeKey = rawFeeType; // fallback, or throw error
  
  // Map "Individual" → "Single" since your table uses 'Single'
  let lessonTypeKey = (rawLessonType && rawLessonType.trim().toLowerCase() === 'individual')
                      ? 'Single'
                      : capitalize(rawLessonType ? rawLessonType.toLowerCase() : '');

  Logger.log('Normalized → feeTypeKey:%s, lessonTypeKey:%s, groupSize:%d',
             feeTypeKey, lessonTypeKey, groupSize);

  // Delegate into calculateFee
  const total = calculateFee(lessonTypeKey, feeTypeKey, groupSize, lessons);
  Logger.log('→ Calculated total: %s', total);
  return total;
}

function getNewPaymentDefaults(studentID) {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const yearStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy');
  
  // 1) pick first available month
  const months = getAvailableMonths(studentID, yearStr);
  const month   = months.length ? months[0] : Utilities.formatDate(new Date(today.getFullYear(), today.getMonth()+1,1), Session.getScriptTimeZone(), 'MMMM');

  // 2) default lessons count = your standard (e.g. 4)
  const defaultLessons = 4;
  
  // 3) calculate total fee
  const total = getTotalFeeFromStudentData(studentID, defaultLessons);

  // 4) default method
  const method = 'Cash';

  // 5) default staff from Code!B1 (or named range "Staff")
  const staffSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Code');
  const staffName  = staffSheet.getRange('B1').getValue();

  return {
    'Transaction ID': '',
    Date:          dateStr,
    Year:          yearStr,
    Month:         month,
    Amount:        defaultLessons,
    Total:         total,
    Method:        method,
    Staff:         staffName
  };
}

function insertPayment(pay) {

  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Payment');
  if (!sh) throw new Error('Sheet "Payment" not found.');

  // 1) Pull headers from the first row (use getDisplayValues for consistency with getStudentDetails)
  var headerData = sh.getDataRange().getDisplayValues();
  var headers = headerData[0];
  // Trim headers to remove any whitespace issues
  var headersTrimmed = headers.map(function(h) { return String(h || '').trim(); });
  
  // Check if Transaction ID column exists
  var txnIdIdx = headersTrimmed.indexOf('Transaction ID');
  if (txnIdIdx === -1) {
    Logger.log('⚠️ Warning: Transaction ID column not found in Payment sheet. Available headers: ' + JSON.stringify(headersTrimmed));
  }

  // 2) Generate Transaction ID if not provided
  if (!pay['Transaction ID'] || pay['Transaction ID'] === '') {
    var timestamp = new Date().getTime();
    var randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    pay['Transaction ID'] = 'TXN' + timestamp + randomSuffix;
  }

  // 3) Build the new row, coercing Amount & Total into numbers
  // Use original headers for mapping to maintain column order
  var newRow = headers.map(function(h, idx) {
    var hTrimmed = headersTrimmed[idx];
    // Try to get value using both original and trimmed header names
    var value = pay[h] || pay[hTrimmed] || '';
    
    switch (hTrimmed) {
      case 'Amount':
        // ensure numeric
        var amount = Number(value) || 0;
        Logger.log('💰 Amount field "%s": %s -> %s', hTrimmed, value, amount);
        return amount;
      case 'Total':
        // ensure numeric
        var total = Number(value) || 0;
        Logger.log('💰 Total field "%s": %s -> %s', hTrimmed, value, total);
        return total;
      default:
        // leave everything else as-is
        Logger.log('💰 Field "%s" (original: "%s"): %s', hTrimmed, h, value);
        return value;
    }
  });

  sh.appendRow(newRow);

  // --- Update Lessons sheet Payment to '済' for this student/month ---
  var lessonSheet = ss.getSheetByName(LESSON_SHEET);
  if (lessonSheet) {
    var lessonData   = lessonSheet.getDataRange().getValues();
    var lessonHeads  = lessonData[0];
    var sidIdx       = lessonHeads.indexOf('Student ID');
    var monIdx       = lessonHeads.indexOf('Month');
    var payIdx       = lessonHeads.indexOf('Payment');
    var monthText    = pay['Month'];
    var yearVal      = pay['Year'] || pay['year'] || Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy');
    var monthNum     = normalizeMonthValue(monthText);
    var monthIdxNum  = monthNum ? monthNum - 1 : 0;
    var tz           = ss.getSpreadsheetTimeZone();
    var formattedMonth = Utilities.formatDate(new Date(parseInt(yearVal,10), monthIdxNum, 1), tz, 'MMMM yyyy');

    for (var i = 1; i < lessonData.length; i++) {
      var row = lessonData[i];
      if (String(row[sidIdx]) === String(pay['Student ID'])) {
        var cell = row[monIdx];
        var match = (cell instanceof Date)
          ? (cell.getFullYear() === parseInt(yearVal,10) && cell.getMonth() === monthIdxNum)
          : (String(cell).trim() === formattedMonth || String(cell).trim() === monthText || String(cell).trim() === (monthText + ' ' + yearVal));
        if (match) {
          lessonSheet.getRange(i+1, payIdx+1).setValue('済');
          break;
        }
      }
    }
  }
  // --- End update ---

  // --- Update student status from Demo/Dormant to Active when payment is made ---
  var studentSheet = ss.getSheetByName(STUDENT_SHEET);
  if (studentSheet) {
    var studentData = studentSheet.getDataRange().getValues();
    var studentHeaders = studentData[0];
    var studentIdIdx = studentHeaders.indexOf('ID');
    var statusIdx = studentHeaders.indexOf('Status');
    
    if (studentIdIdx !== -1 && statusIdx !== -1) {
      for (var i = 1; i < studentData.length; i++) {
        var row = studentData[i];
        if (String(row[studentIdIdx]) === String(pay['Student ID'])) {
          var currentStatus = String(row[statusIdx] || '').trim();
          if (currentStatus === 'Demo' || currentStatus === 'Dormant') {
            studentSheet.getRange(i + 1, statusIdx + 1).setValue('Active');
            Logger.log('📝 Updated student ID ' + pay['Student ID'] + ' status from ' + currentStatus + ' to Active due to payment');
          }
          break;
        }
      }
    }
  }
  // --- End status update ---

  return true;
}

function getLessonCountsForDashboard() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(LESSON_SHEET);
  var values = sh.getDataRange().getDisplayValues();
  var headers = values.shift();
  var monthIdx = headers.indexOf('Month');
  var lessonsIdx = headers.indexOf('Booked'); // or 'Lessons' if that's the column name

  var tz = Session.getScriptTimeZone();
  var today = new Date();
  var thisMonth = Utilities.formatDate(today, tz, 'MMMM yyyy');
  var lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, tz, 'MMMM yyyy');

  var thisMonthCount = 0, lastMonthCount = 0;

  values.forEach(function(row) {
    if (row[monthIdx] === thisMonth) {
      thisMonthCount += Number(row[lessonsIdx]) || 0;
    }
    if (row[monthIdx] === lastMonth) {
      lastMonthCount += Number(row[lessonsIdx]) || 0;
    }
  });

  return { thisMonth: thisMonthCount, lastMonth: lastMonthCount };
}

function getChartImage() {
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('Chart');
  if (!sheet) {
    Logger.log('No sheet named Chart');
    return '';
  }
  var charts = sheet.getCharts();
  Logger.log('Charts found: ' + charts.length);
  if (!charts || charts.length === 0) {
    Logger.log('No charts on Chart sheet');
    return '';
  }
  var blob = charts[0].getAs('image/png');
  Logger.log('Chart blob size: ' + blob.getBytes().length);
  return Utilities.base64Encode(blob.getBytes());
}

function isValidLessonEvent_(event) {
  // Get the event color
  var color = event.getColor();
  
  // Check if the color indicates a cancelled/rescheduled lesson
  // Graphite (8), Lavender (9), and Banana (5) indicate cancelled/rescheduled events
  if (color === '8' || color === '9' || color === '5') {
    return false;
  }
  return true;
}

function getAllEventsForMonth(monthText) {
  // Accepts 'May 2025', '2025-05', 'MMMM yyyy', or 'YYYY-MM'
  // Returns ALL events regardless of status (no filtering)
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var year, monthNum;
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    year = Number(parts[0]);
    monthNum = Number(parts[1]) - 1;
  } else if (/^[A-Za-z]+ \d{4}$/.test(monthText)) { // 'May 2025'
    var parts = monthText.trim().split(' ');
    monthNum = monthNames.indexOf(parts[0]);
    year = Number(parts[1]);
  } else {
    throw new Error('Invalid monthText format: ' + monthText);
  }
  var startDate = new Date(year, monthNum, 1);
  var endDate = new Date(year, monthNum + 1, 1);
  var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
  return calendar.getEvents(startDate, endDate);
}

function getStudentEventsForMonth(studentName, monthText) {
  // Get all events for a specific student in a month from cached MonthlySchedule data
  Logger.log('=== getStudentEventsForMonth called ===');
  Logger.log('Student name: ' + studentName);
  Logger.log('Month text: ' + monthText);
  
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) {
    Logger.log('MonthlySchedule sheet not found, creating cache...');
    // If no cache exists, create it for this month
    cacheMonthlyEvents(monthText);
  }
  
  var data = cacheSheet.getDataRange().getValues();
  Logger.log('MonthlySchedule data rows: ' + data.length);
  
  if (data.length < 2) {
    Logger.log('No data in MonthlySchedule sheet');
    return []; // No data
  }
  
  var headers = data[0];
  Logger.log('Headers: ' + JSON.stringify(headers));
  
  var studentNameIdx = headers.indexOf('StudentName');
  var statusIdx = headers.indexOf('Status');
  var startIdx = headers.indexOf('Start');
  var endIdx = headers.indexOf('End');
  var eventIdIdx = headers.indexOf('EventID');
  // Fallback if header row was misaligned (e.g., month written into A1 previously)
  if (eventIdIdx === -1) {
    Logger.log('EventID column not found in headers, falling back to column 0');
    eventIdIdx = 0;
  }
  var titleIdx = headers.indexOf('Title');
  
  Logger.log('Column indices - StudentName: ' + studentNameIdx + ', Status: ' + statusIdx + ', Start: ' + startIdx + ', EventID: ' + eventIdIdx);
  Logger.log('Indices - EventID: ' + eventIdIdx + ', Title: ' + titleIdx + ', Start: ' + startIdx + ', Status: ' + statusIdx);
  
  var studentEvents = [];
  
  Logger.log('Searching for student: "' + studentName + '" in month: "' + monthText + '"');
  Logger.log('Total rows in MonthlySchedule: ' + (data.length - 1));
  
  // Parse the target month to get year and month number
  var targetYear, targetMonth;
  if (monthText.includes(' ')) {
    // Format: "September 2024"
    var parts = monthText.split(' ');
    var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    targetMonth = monthNames.indexOf(parts[0]);
    targetYear = parseInt(parts[1]);
  } else {
    // Format: "2024-09"
    var parts = monthText.split('-');
    targetYear = parseInt(parts[0]);
    targetMonth = parseInt(parts[1]) - 1;
  }
  
  Logger.log('Target year: ' + targetYear + ', target month: ' + targetMonth);
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowStudentName = String(row[studentNameIdx] || '').trim();
    var startTime = row[startIdx];
    
    // Check if this row is for the target student
    if (rowStudentName === studentName) {
      // Check if the event is in the target month
      if (startTime instanceof Date) {
        var eventYear = startTime.getFullYear();
        var eventMonth = startTime.getMonth();
        
        Logger.log('Row ' + i + ' - Event date: ' + startTime + ' (Year: ' + eventYear + ', Month: ' + eventMonth + ')');
        
        if (eventYear === targetYear && eventMonth === targetMonth) {
          Logger.log('Found matching student and month in row ' + i);
          var status = String(row[statusIdx] || 'scheduled');
          
          // Extract day and time
          var day = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'dd');
          var time = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
          
          // Get eventID if available
          var eventID = eventIdIdx >= 0 ? String(row[eventIdIdx] || '').trim() : '';
          
          Logger.log('Matched row ' + i + ': eventID=' + eventID + ', day=' + day + ', time=' + time + ', status=' + status + ', title=' + row[titleIdx]);
          
          var eventObj = {
            day: day,
            time: time,
            status: status
          };
          
          // Add eventID if available (support both eventID and eventId for compatibility)
          if (eventID) {
            eventObj.eventID = eventID;
            eventObj.eventId = eventID;
          } else {
            Logger.log('⚠️ No EventID for row ' + i + ' (' + day + ' ' + time + ') despite match');
          }
          
          studentEvents.push(eventObj);
        }
      }
    }
  }
  
  Logger.log('Total events found for student in target month: ' + studentEvents.length);
  Logger.log('Events: ' + JSON.stringify(studentEvents));
  
  return studentEvents;
}

function getLessonEventsForMonth(monthText) {
  // Accepts 'May 2025', '2025-05', 'MMMM yyyy', or 'YYYY-MM'
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var year, monthNum;
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    year = Number(parts[0]);
    monthNum = Number(parts[1]) - 1;
  } else if (/^[A-Za-z]+ \d{4}$/.test(monthText)) { // 'May 2025'
    var parts = monthText.trim().split(' ');
    monthNum = monthNames.indexOf(parts[0]);
    year = Number(parts[1]);
  } else {
    throw new Error('Invalid monthText format: ' + monthText);
  }
  var startDate = new Date(year, monthNum, 1);
  var endDate = new Date(year, monthNum + 1, 1);
  var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
  return calendar.getEvents(startDate, endDate);
}

/**
 * Fetch lessons for the current month and log them to console for debugging
 * This function is used by the booking component to get lesson data
 */
function fetchLessonsForCurrentMonth() {
  try {
    Logger.log('=== Fetching lessons for current month ===');
    
    // Get current month in the format expected by getLessonEventsForMonth
    var now = new Date();
    var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMMM yyyy');
    
    Logger.log('Current month: ' + currentMonth);
    
    // Fetch lesson events for current month
    var events = getLessonEventsForMonth(currentMonth);
    
    Logger.log('Total events found: ' + events.length);
    
    // Process and log each lesson event
    var lessons = [];
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var lesson = {
        title: event.getTitle(),
        startTime: event.getStartTime(),
        endTime: event.getEndTime(),
        description: event.getDescription(),
        location: event.getLocation(),
        color: event.getColor(),
        isAllDay: event.isAllDayEvent(),
        isRecurring: event.isRecurringEvent()
      };
      
      lessons.push(lesson);
      
      // Log individual lesson details
      Logger.log('Lesson ' + (i + 1) + ':');
      Logger.log('  Title: ' + lesson.title);
      Logger.log('  Start: ' + lesson.startTime);
      Logger.log('  End: ' + lesson.endTime);
      Logger.log('  Color: ' + lesson.color);
      Logger.log('  All Day: ' + lesson.isAllDay);
      Logger.log('  Recurring: ' + lesson.isRecurring);
      if (lesson.description) {
        Logger.log('  Description: ' + lesson.description);
      }
      if (lesson.location) {
        Logger.log('  Location: ' + lesson.location);
      }
      Logger.log('  ---');
    }
    
    // Log summary
    Logger.log('=== Lesson Summary for ' + currentMonth + ' ===');
    Logger.log('Total lessons: ' + lessons.length);
    
    // Group by day for better overview
    var lessonsByDay = {};
    for (var j = 0; j < lessons.length; j++) {
      var lesson = lessons[j];
      var dayKey = Utilities.formatDate(lesson.startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (!lessonsByDay[dayKey]) {
        lessonsByDay[dayKey] = [];
      }
      lessonsByDay[dayKey].push(lesson);
    }
    
    // Log lessons grouped by day
    for (var day in lessonsByDay) {
      Logger.log('Day ' + day + ': ' + lessonsByDay[day].length + ' lessons');
      for (var k = 0; k < lessonsByDay[day].length; k++) {
        var dayLesson = lessonsByDay[day][k];
        var timeStr = Utilities.formatDate(dayLesson.startTime, Session.getScriptTimeZone(), 'HH:mm');
        Logger.log('  - ' + timeStr + ': ' + dayLesson.title);
      }
    }
    
    Logger.log('=== End of lesson data ===');
    
    return {
      success: true,
      month: currentMonth,
      totalLessons: lessons.length,
      lessons: lessons,
      lessonsByDay: lessonsByDay
    };
    
  } catch (error) {
    Logger.log('Error fetching lessons for current month: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Simple test function to check if Google Apps Script is working
 * @returns {string} Test message
 */
function testFunction() {
  Logger.log('=== testFunction called ===');
  return 'Google Apps Script is working!';
}

/**
 * Test function that returns a simple object to check serialization
 * @returns {Object} Simple test object
 */
function testObjectReturn() {
  Logger.log('=== testObjectReturn called ===');
  try {
    var result = {
      success: true,
      message: 'Object return test',
      timestamp: new Date().toISOString()
    };
    Logger.log('Returning object: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('ERROR in testObjectReturn: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test function to check spreadsheet access
 * @returns {Object} Test result
 */
function testSpreadsheetAccess() {
  try {
    Logger.log('=== testSpreadsheetAccess called ===');
    Logger.log('SS_ID: ' + SS_ID);
    
    var ss = SpreadsheetApp.openById(SS_ID);
    Logger.log('Spreadsheet opened successfully');
    
    var sheetNames = [];
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      sheetNames.push(sheets[i].getName());
    }
    Logger.log('Available sheets: ' + JSON.stringify(sheetNames));
    
    return {
      success: true,
      message: 'Spreadsheet access working',
      sheetNames: sheetNames
    };
    
  } catch (error) {
    Logger.log('ERROR in testSpreadsheetAccess: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Fetch actual lesson data from Google Calendar
 * @returns {Object} Real lesson data from calendar
 */
function fetchAllSheetEntries() {
  try {
    Logger.log('=== fetchAllSheetEntries called - fetching real calendar data ===');
    
    // Use existing LESSON_CALENDAR_ID from Code.js configuration
    if (!LESSON_CALENDAR_ID) {
      Logger.log('LESSON_CALENDAR_ID not configured');
      return { success: false, error: 'Calendar ID not configured', data: [] };
    }
    
    // Get today's date range
    var today = new Date();
    var startTime = new Date(today);
    startTime.setHours(0, 0, 0, 0);
    var endTime = new Date(today);
    endTime.setDate(endTime.getDate() + 1);
    
    Logger.log('Fetching events from ' + startTime + ' to ' + endTime);
    Logger.log('Using calendar ID: ' + LESSON_CALENDAR_ID);
    
    // Get calendar events using existing configuration
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    if (!calendar) {
      Logger.log('Calendar not found: ' + LESSON_CALENDAR_ID);
      return { success: false, error: 'Calendar not found', data: [] };
    }
    
    var events = calendar.getEvents(startTime, endTime);
    Logger.log('Found ' + events.length + ' events');
    
    // Process events with proper error handling and date serialization
    var processedEvents = [];
    for (var i = 0; i < events.length; i++) {
      try {
        var event = events[i];
        var eventData = {
          id: event.getId(),
          title: event.getTitle(),
          startTime: Utilities.formatDate(event.getStartTime(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
          endTime: Utilities.formatDate(event.getEndTime(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
          description: event.getDescription() || '',
          location: event.getLocation() || '',
          color: event.getColor(),
          isAllDay: event.isAllDayEvent()
        };
        processedEvents.push(eventData);
        Logger.log('Event ' + (i + 1) + ': ' + eventData.title + ' at ' + eventData.startTime);
      } catch (eventError) {
        Logger.log('Error processing event ' + (i + 1) + ': ' + eventError.toString());
        continue;
      }
    }
    
    var result = {
      success: true,
      data: processedEvents,
      rowCount: processedEvents.length,
      message: 'Real calendar events retrieved successfully',
      timestamp: new Date().toISOString(),
      dateRange: {
        start: Utilities.formatDate(startTime, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        end: Utilities.formatDate(endTime, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
      }
    };
    
    Logger.log('Returning real calendar data with ' + processedEvents.length + ' events');
    Logger.log('Result: ' + JSON.stringify(result));
    return result;
    
  } catch (error) {
    Logger.log('Calendar fetch error: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      data: []
    };
  }
}

/**
 * Alternative function to test data fetching with different name
 * @returns {Object} Test lesson data
 */
function getTestLessons() {
  Logger.log('=== getTestLessons called ===');
  
  try {
    var testData = {
      success: true,
      data: [
        {
          id: 'alt-test-1',
          title: 'Alternative Test Lesson 1',
          startTime: '10:00',
          endTime: '11:00',
          description: 'Test lesson 1',
          location: 'Test Location',
          color: 'blue',
          isAllDay: false
        },
        {
          id: 'alt-test-2',
          title: 'Alternative Test Lesson 2', 
          startTime: '14:00',
          endTime: '15:00',
          description: 'Test lesson 2',
          location: 'Test Location 2',
          color: 'red',
          isAllDay: false
        }
      ],
      rowCount: 2,
      message: 'Alternative test function working',
      timestamp: new Date().toISOString()
    };
    
    Logger.log('getTestLessons returning: ' + JSON.stringify(testData));
    return testData;
    
  } catch (error) {
    Logger.log('Error in getTestLessons: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      data: []
    };
  }
}

/**
 * Get lessons for a specific week for calendar display
 * @param {string} weekStart - Week start date in ISO format
 * @returns {Object} Lessons organized by date and time for calendar display
 */
function getLessonsForWeek(weekStart) {
  try {
    Logger.log('=== getLessonsForWeek called ===');
    Logger.log('weekStart: ' + weekStart);
    Logger.log('weekStart type: ' + typeof weekStart);
    
    // Validate input
    if (!weekStart) {
      Logger.log('ERROR: weekStart is null or undefined');
      return {
        success: false,
        error: 'weekStart parameter is required',
        lessonsByDay: {}
      };
    }
    
    var startDate = new Date(weekStart);
    if (isNaN(startDate.getTime())) {
      Logger.log('ERROR: Invalid weekStart date: ' + weekStart);
      return {
        success: false,
        error: 'Invalid weekStart date format',
        lessonsByDay: {}
      };
    }
    
    var endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7); // Get 7 days from start
    
    Logger.log('Fetching lessons from ' + startDate.toISOString() + ' to ' + endDate.toISOString());
    
    // Check if calendar ID is configured
    if (!LESSON_CALENDAR_ID) {
      Logger.log('ERROR: LESSON_CALENDAR_ID is not configured');
      return {
        success: false,
        error: 'Calendar ID not configured',
        lessonsByDay: {}
      };
    }
    
    // Get calendar events for the week
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    if (!calendar) {
      Logger.log('ERROR: Calendar not found with ID: ' + LESSON_CALENDAR_ID);
      return {
        success: false,
        error: 'Calendar not found',
        lessonsByDay: {}
      };
    }
    
    var events = calendar.getEvents(startDate, endDate);
    Logger.log('Found ' + events.length + ' events in the week');
    
    var lessonsByDay = {};
    
    // Process each event
    for (var i = 0; i < events.length; i++) {
      try {
        var event = events[i];
        var startTime = event.getStartTime();
        var endTime = event.getEndTime();
        var title = event.getTitle();
        var color = event.getColor();
        
        Logger.log('Processing event ' + (i + 1) + ': ' + title);
        
        // Skip invalid events
        if (!isValidLessonEvent_(event)) {
          Logger.log('Skipping invalid event: ' + title);
          continue;
        }
        
        // Get date and time strings
        var eventDate = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        var eventTime = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
        
        Logger.log('Event date: ' + eventDate + ', time: ' + eventTime);
        
        // Initialize day if not exists
        if (!lessonsByDay[eventDate]) {
          lessonsByDay[eventDate] = {};
        }
        
        // Initialize time slot if not exists
        if (!lessonsByDay[eventDate][eventTime]) {
          lessonsByDay[eventDate][eventTime] = [];
        }
        
        // Determine lesson status based on color
        var status = 'scheduled';
        if (color === '8' || color === '9') { // Graphite, Lavender
          status = 'cancelled';
        } else if (color === '5') { // Banana
          status = 'rescheduled';
        } else if (color === '11') { // Orange/Tomato
          status = 'demo';
        }
        
        // Clean title (strip any trailing time that may be embedded in title)
        var cleanTitle = title.replace(/,?\s*\d{1,2}:\d{2}(\s*-\s*\d{1,2}:\d{2})?$/,'').trim();
        
        // Add lesson to the time slot
        lessonsByDay[eventDate][eventTime].push({
          title: cleanTitle,
          studentName: cleanTitle, // Use title as student name for now
          status: status,
          startTime: startTime,
          endTime: endTime,
          color: color
        });
        
        Logger.log('Added lesson to ' + eventDate + ' at ' + eventTime);
      } catch (eventError) {
        Logger.log('Error processing event ' + (i + 1) + ': ' + eventError.toString());
        continue;
      }
    }
    
    Logger.log('Processed lessons for ' + Object.keys(lessonsByDay).length + ' days');
    Logger.log('Final lessonsByDay: ' + JSON.stringify(lessonsByDay));
    
    return {
      success: true,
      lessonsByDay: lessonsByDay,
      totalLessons: events.length
    };
    
  } catch (error) {
    Logger.log('ERROR in getLessonsForWeek: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return {
      success: false,
      error: error.toString(),
      lessonsByDay: {}
    };
  }
}

function updateScheduledLessonsForStudent(studentId, studentName, monthStr) {
  Logger.log('--- updateScheduledLessonsForStudent ---');
  Logger.log('Student ID: %s, Student Name: %s, Month: %s', studentId, studentName, monthStr);
  var ss = SpreadsheetApp.openById(SS_ID);
  var lessonsSheet = ss.getSheetByName('Lessons');
  var data = lessonsSheet.getDataRange().getValues();
  var idCol = data[0].indexOf('Student ID');
  var monthCol = data[0].indexOf('Month');
  var scheduledCol = data[0].indexOf('Scheduled');

  // Use new reusable function
  var events = getLessonEventsForMonth(monthStr);
  Logger.log('Found %s events in calendar for this range.', events.length);
  var namePattern = new RegExp(studentName + '\\b'); // Match name anywhere in title
  var scheduledCount = 0;
  events.forEach(function(event) {
    var title = event.getTitle();
    var valid = namePattern.test(title) && isValidLessonEvent_(event);
    Logger.log('Event: "%s" | Valid: %s', title, valid);
    if (valid) {
      scheduledCount++;
    }
  });
  Logger.log('Scheduled count for %s in %s: %s', studentName, monthStr, scheduledCount);

  // Update Lessons sheet
  var updated = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) == String(studentId) && data[i][monthCol] == monthStr) {
      lessonsSheet.getRange(i + 1, scheduledCol + 1).setValue(scheduledCount);
      Logger.log('Updated Lessons sheet at row %s, col %s with value %s', i+1, scheduledCol+1, scheduledCount);
      updated = true;
      break;
    }
  }
  if (!updated) {
    Logger.log('No matching row found in Lessons sheet for Student ID %s and Month %s.', studentId, monthStr);
  }
  return scheduledCount;
}



function toYYYYMM(dateOrString) {
  if (!dateOrString) return '';
  if (dateOrString instanceof Date) {
    return Utilities.formatDate(dateOrString, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  var s = String(dateOrString).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.substring(0,7);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    var parts = s.split('/');
    var d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  // Try parsing 'MMMM yyyy' (e.g., 'February 2022')
  var m = s.match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/);
  if (m) {
    var monthNum = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(m[1]);
    return m[2] + '-' + ('0' + (monthNum+1)).slice(-2);
  }
  // Fallback: try Date parse
  var d2 = new Date(s);
  if (!isNaN(d2)) return Utilities.formatDate(d2, Session.getScriptTimeZone(), 'yyyy-MM');
  return '';
}

/**
 * Process events and extract valid lesson rows
 * @param {Array} events - Array of calendar events
 * @returns {Array} Array of processed event rows
 */
function processEventsForMonth(events) {
  var validRows = [];
  events.forEach(function(event) {
    var title = event.getTitle();
    // Ignore teacher breaks (case-insensitive 'break' or 'Teacher' in title)
    if (/break/i.test(title) || /teacher/i.test(title)) return;
    
    // Check for placeholder events first
    var status = 'scheduled'; // default
    if (/(placeholder)/i.test(title)) {
      status = 'reserved';
      Logger.log('📅 Found placeholder event: ' + title + ' -> Status: reserved');
    } else if (/\[RESCHEDULED\]/i.test(title)) {
      // Check for [RESCHEDULED] prefix in title (original event that was moved)
      status = 'rescheduled';
      Logger.log('📅 Found rescheduled event (original): ' + title + ' -> Status: rescheduled');
    } else {
      // Determine status based on event color (only if not a placeholder or rescheduled)
      var color = event.getColor();
      if (color === '8' || color === '9') { // Graphite, Lavender
        status = 'cancelled';
      } else if (color === '5') { // Banana
        status = 'rescheduled';
      } else if (color === '11') { // Orange/Tomato
        status = 'demo';
      }
    }
    
    // Check if title contains '子' marker BEFORE removing it
    var isKidsLesson = /子/.test(title);
    
    // Extract the part before the first parenthesis
    var namePart = title.split('(')[0];
    // Remove [RESCHEDULED] prefix if present (for proper student name extraction)
    namePart = namePart.replace(/\[RESCHEDULED\]\s*/gi, '');
    // Remove all occurrences of '子' (anywhere) AFTER detecting it
    namePart = namePart.replace(/子/g, '');
    // Split by ' and ' (case-insensitive, surrounded by spaces)
    var names = namePart.split(/\s+and\s+/i).map(function(n) { return n.trim(); }).filter(Boolean);
    // Improved last name inheritance for group lessons
    // Find last name from the last name in the group (if present)
    var lastName = '';
    if (names.length > 1) {
      var lastParts = names[names.length - 1].split(/\s+/);
      if (lastParts.length > 1) {
        lastName = lastParts[lastParts.length - 1];
      }
    }

    // Determine teacher name from calendar ID (used for all rows)
    var teacherName = '';
    try {
      var calendarId = event.getOriginalCalendarId();
      if (calendarId === OWNERS_COURSE_CAL_ID) {
        teacherName = 'Sham';
      }
      // Add more teacher calendar checks here if needed
    } catch (e) {
      Logger.log('Could not get calendar ID for event: ' + e.toString());
    }

    for (var i = 0; i < names.length; i++) {
      var parts = names[i].split(/\s+/);
      if (parts.length > 1) {
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          status,
          names[i],
          isKidsLesson ? '子' : '',  // IsKidsLesson column
          teacherName  // TeacherName column
        ]);
      } else {
        // If no last name, append the lastName found from the group
        var fullName = parts[0] + (lastName ? ' ' + lastName : '');
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          status,
          fullName.trim(),
          isKidsLesson ? '子' : '',  // IsKidsLesson column
          teacherName  // TeacherName column (ensure 8 columns)
        ]);
      }
    }
  });
  return validRows;
}

/**
 * Cache events for a specific month to a specific sheet
 * @param {string} monthStr - Month in format 'YYYY-MM' or 'MMMM yyyy'
 * @param {string} sheetName - Name of the sheet to write to
 * @returns {number} Number of events processed
 */
function cacheEventsToSheet(monthStr, sheetName) {
  // Standardize monthStr to 'YYYY-MM'
  var yyyymm = toYYYYMM(monthStr);
  if (!yyyymm) {
    Logger.log('Invalid monthStr format: ' + monthStr);
    return 0;
  }
  
  Logger.log('Caching events for month: ' + monthStr + ' (YYYY-MM: ' + yyyymm + ') to sheet: ' + sheetName);
  
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName(sheetName);
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet(sheetName);
  } else {
    cacheSheet.clear();
  }
  
  // Write headers - ADD NEW COLUMN
  var headers = ['EventID', 'Title', 'Start', 'End', 'Status', 'StudentName', 'IsKidsLesson', 'TeacherName'];
  cacheSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Fetch from both lesson calendars (main + Owner's Course)
  var lessonCal = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
  var ownersCal = CalendarApp.getCalendarById(OWNERS_COURSE_CAL_ID);
  var calendars = [lessonCal, ownersCal].filter(Boolean);
  if (!calendars.length) {
    Logger.log('No lesson calendars found for caching.');
    return 0;
  }
  var monthDateStart = new Date(yyyymm + '-01');
  var monthDateEnd = new Date(monthDateStart.getFullYear(), monthDateStart.getMonth() + 1, 1);
  var allEvents = [];
  calendars.forEach(function(cal){
    var evts = cal.getEvents(monthDateStart, monthDateEnd);
    Logger.log('Retrieved ' + evts.length + ' events from calendar ' + cal.getId() + ' for ' + monthStr);
    allEvents = allEvents.concat(evts);
  });
  
  // Process events using the extracted function
  var validRows = processEventsForMonth(allEvents);
  
  // Count different status types for summary
  var statusCounts = {};
  validRows.forEach(function(row) {
    var status = row[4]; // Status is the 5th column (index 4)
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  Logger.log('Processed ' + validRows.length + ' valid lesson events');
  Logger.log('Status breakdown: ' + JSON.stringify(statusCounts));
  
  if (validRows.length > 0) {
    cacheSheet.getRange(2, 1, validRows.length, headers.length).setValues(validRows);
  }
  
  // Refresh booking availability for affected months
  try {
    var monthDate = new Date(yyyymm + '-01');
    if (!isNaN(monthDate.getTime())) {
      var weekStart = new Date(monthDate);
      var dayOfWeek = weekStart.getDay();
      var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
      weekStart.setDate(weekStart.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);
      
      // Refresh 4 weeks starting from the first week of the month
      for (var week = 0; week < 4; week++) {
        var weekToRefresh = new Date(weekStart);
        weekToRefresh.setDate(weekStart.getDate() + (week * 7));
        calculateAndStoreWeekAvailability(weekToRefresh, true);
      }
    }
  } catch (e) {
    Logger.log('Error refreshing booking availability after cache update: ' + e.toString());
  }
  
  return validRows.length;
}

function cacheMonthlyEvents(monthStr) {
  // Default to current month if no monthStr provided
  if (!monthStr) {
    var today = new Date();
    monthStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
  }
  
  return cacheEventsToSheet(monthStr, 'MonthlySchedule');
}

// ===== MonthlySchedule write-through helpers =====
function getMonthlyScheduleSheet_() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('MonthlySchedule');
  if (!sheet) {
    sheet = ss.insertSheet('MonthlySchedule');
  }
  // Ensure headers
  var headers = ['EventID', 'Title', 'Start', 'End', 'Status', 'StudentName', 'IsKidsLesson', 'TeacherName'];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function upsertMonthlyScheduleRow_(payload) {
  if (!payload || !payload.eventId) return;
  var sheet = getMonthlyScheduleSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var eventIdx = headers.indexOf('EventID');
  var titleIdx = headers.indexOf('Title');
  var startIdx = headers.indexOf('Start');
  var endIdx = headers.indexOf('End');
  var statusIdx = headers.indexOf('Status');
  var nameIdx = headers.indexOf('StudentName');
  var kidsIdx = headers.indexOf('IsKidsLesson');
  var teacherIdx = headers.indexOf('TeacherName');
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][eventIdx] || '') === String(payload.eventId)) {
      foundRow = i + 1; // 1-based for sheet
      break;
    }
  }
  var rowValues = [
    payload.eventId,
    payload.title || '',
    payload.startTime || '',
    payload.endTime || '',
    payload.status || 'scheduled',
    payload.studentName || '',
    payload.isKidsLesson ? '子' : '',
    payload.teacherName || ''
  ];
  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function updateMonthlyScheduleStatus_(eventId, status, title, startTime, endTime) {
  if (!eventId) return;
  var sheet = getMonthlyScheduleSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var eventIdx = headers.indexOf('EventID');
  var statusIdx = headers.indexOf('Status');
  var titleIdx = headers.indexOf('Title');
  var startIdx = headers.indexOf('Start');
  var endIdx = headers.indexOf('End');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][eventIdx] || '') === String(eventId)) {
      if (statusIdx >= 0) data[i][statusIdx] = status;
      if (titleIdx >= 0 && title) data[i][titleIdx] = title;
      if (startIdx >= 0 && startTime) data[i][startIdx] = startTime;
      if (endIdx >= 0 && endTime) data[i][endIdx] = endTime;
      sheet.getRange(i + 1, 1, 1, data[i].length).setValues([data[i]]);
      return;
    }
  }
  // If not found, insert new row
  upsertMonthlyScheduleRow_({
    eventId: eventId,
    title: title,
    startTime: startTime,
    endTime: endTime,
    status: status
  });
}

function removeMonthlyScheduleRow_(eventId) {
  if (!eventId) return;
  var sheet = getMonthlyScheduleSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var eventIdx = headers.indexOf('EventID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][eventIdx] || '') === String(eventId)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/**
 * Cache events for both current month and next month into separate sheets
 * @returns {Object} Summary of events processed for both months
 */
function cacheMonthlyEventsForBothMonths() {
  Logger.log('=== Starting dual month cache operation ===');
  
  // Calculate current and next month
  var today = new Date();
  var currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM');
  
  // Calculate next month
  var nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  var nextMonth = Utilities.formatDate(nextMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  
  Logger.log('Current month: ' + currentMonth);
  Logger.log('Next month: ' + nextMonth);
  
  var results = {
    currentMonth: {
      month: currentMonth,
      events: 0,
      sheetName: 'MonthlySchedule'
    },
    nextMonth: {
      month: nextMonth,
      events: 0,
      sheetName: 'NextMonthSchedule'
    }
  };
  
  try {
    // Process current month
    Logger.log('Processing current month: ' + currentMonth);
    results.currentMonth.events = cacheEventsToSheet(currentMonth, 'MonthlySchedule');
    Logger.log('✅ Current month processed: ' + results.currentMonth.events + ' events');
    
    // Process next month
    Logger.log('Processing next month: ' + nextMonth);
    results.nextMonth.events = cacheEventsToSheet(nextMonth, 'NextMonthSchedule');
    Logger.log('✅ Next month processed: ' + results.nextMonth.events + ' events');
    
  } catch (error) {
    Logger.log('❌ Error in dual month cache operation: ' + error.toString());
    results.error = error.toString();
  }
  
  Logger.log('=== Dual month cache operation completed ===');
  Logger.log('Results: ' + JSON.stringify(results));
  
  return results;
}

function tallyLessonsForMonthAndStore(monthStr) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var statsSheet = ss.getSheetByName('Stats');
  if (!statsSheet) statsSheet = ss.insertSheet('Stats');
  // Add headers if the sheet is empty
  if (statsSheet.getLastRow() === 0) {
    statsSheet.appendRow(['Month', 'Lessons', 'Students']);
  }
  // Tally lessons and students from MonthlySchedule for the given month
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) return;
  var data = cacheSheet.getDataRange().getValues();
  if (data.length < 2) return; // No events (just headers)
  var headers = data[0];
  var startIdx = headers.indexOf('Start');
  var studentNameIdx = headers.indexOf('StudentName');
  var lessons = 0;
  var studentSet = new Set();
  for (var i = 1; i < data.length; i++) {
    var start = data[i][startIdx];
    var eventMonth = toYYYYMM(start);
    if (eventMonth === monthStr) {
      lessons++;
      // Add all students in this event (split by ' and ')
      var studentCell = data[i][studentNameIdx];
      if (studentCell) {
        studentCell.split(/\s+and\s+/i).forEach(function(name) {
          studentSet.add(name.trim());
        });
      }
    }
  }
  var uniqueStudents = studentSet.size;

  // Write to Stats sheet (update if exists, else append)
  var statsData = statsSheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < statsData.length; i++) {
    if (toYYYYMM(statsData[i][0]) === monthStr) {
      statsSheet.getRange(i+1, 2, 1, 2).setValues([[lessons, uniqueStudents]]);
      found = true;
      break;
    }
  }
  if (!found) {
    statsSheet.appendRow([monthStr, lessons, uniqueStudents]);
  }
}

function renderDashboard() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // 1. Get lessons and students for this month from Stats
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var now = new Date();
  var thisMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  var lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lessonsThisMonth = 0;
  var studentsThisMonth = 0;
  var lessonsLastMonth = 0;
  var studentsLastMonth = 0;
  console.log('Stats sheet data:', JSON.stringify(stats));
  for (var i = 1; i < stats.length; i++) {
    var monthCell = stats[i][0];
    var monthStr = toYYYYMM(monthCell);
    if (monthStr === thisMonth) {
      lessonsThisMonth = Number(stats[i][1]) || 0;
      studentsThisMonth = Number(stats[i][2]) || 0;
    }
    if (monthStr === lastMonth) {
      lessonsLastMonth = Number(stats[i][1]) || 0;
      studentsLastMonth = Number(stats[i][2]) || 0;
    }
  }
  var diff = lessonsThisMonth - lessonsLastMonth;
  var diffText = (diff >= 0 ? '+' : '') + diff + ' this month';
  console.log('Current month:', thisMonth, 'Lessons:', lessonsThisMonth, 'Students:', studentsThisMonth);

  // 2. Get total fees for this month from Payment sheet
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var paymentData = paymentSheet ? paymentSheet.getDataRange().getValues() : [];
  var paymentHeaders = paymentData[0] || [];
  var yearIdx = paymentHeaders.indexOf('Year');
  var monthIdx = paymentHeaders.indexOf('Month');
  var totalIdx = paymentHeaders.indexOf('Total');
  var thisYear = now.getFullYear().toString();
  var thisMonthName = now.toLocaleString('default', { month: 'long' });
  var feesThisMonth = 0;
  console.log('Payment sheet data:', JSON.stringify(paymentData));
  for (var i = 1; i < paymentData.length; i++) {
    var row = paymentData[i];
    // Accept both YYYY-MM and Month/Year formats
    var rowYear = String(row[yearIdx] || '').trim();
    var rowMonth = String(row[monthIdx] || '').trim();
    var rowTotal = row[totalIdx];
    // Try to match either 'YYYY-MM' or month name/year
    var match = false;
    if (rowYear === thisYear) {
      // If Month is 'YYYY-MM'
      if (/^\d{4}-\d{2}$/.test(rowMonth) && rowMonth === thisMonth) match = true;
      // If Month is full month name
      if (rowMonth === thisMonthName) match = true;
      // If Month is numeric (e.g., '6' for June)
      if (!isNaN(rowMonth) && Number(rowMonth) === (now.getMonth() + 1)) match = true;
    }
    if (match && rowTotal && !isNaN(rowTotal)) {
      feesThisMonth += Number(rowTotal);
    }
  }
  console.log('Fees this month:', feesThisMonth);

  return `
    <div style="padding:2rem; background:#f8fafc; min-height:100vh;">
      <h2 style="font-size:2rem; font-weight:600; margin-bottom:2rem;">Dashboard</h2>
      <div style="display:flex; gap:2rem; flex-wrap:wrap; margin-bottom:2.5rem;">
        <div style="background:#fff; border-radius:1rem; box-shadow:0 2px 15px rgba(0,0,0,0.07); padding:2rem 2.5rem; min-width:260px;">
          <div style="font-size:1.2rem; color:#888; margin-bottom:.5rem;">Lessons Booked</div>
          <div style="font-size:2.8rem; font-weight:700; color:#2980b9;">${lessonsThisMonth}</div>
          <span style="margin-top:.5rem; font-size:.95rem; color:#2980b9; background:#eaf4fa; border-radius:.5rem; padding:.2rem .75rem;">${diffText}</span>
        </div>
        <div style="background:#fff; border-radius:1rem; box-shadow:0 2px 15px rgba(0,0,0,0.07); padding:2rem 2.5rem; min-width:260px;">
          <div style="font-size:1.2rem; color:#888; margin-bottom:.5rem;">Students this month</div>
          <div style="font-size:2.8rem; font-weight:700; color:#27ae60;">${studentsThisMonth}</div>
        </div>
        <div style="background:#fff; border-radius:1rem; box-shadow:0 2px 15px rgba(0,0,0,0.07); padding:2rem 2.5rem; min-width:260px;">
          <div style="font-size:1.2rem; color:#888; margin-bottom:.5rem;">Fees this month</div>
          <div style="font-size:2.8rem; font-weight:700; color:#e67e22;">${feesThisMonth.toLocaleString()}</div>
        </div>
      </div>
      <h2>Payment Logs</h2>
      <div class="table-responsive">
        <table class="table table-hover" id="paymentLogTable">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Year</th>
              <th>Month</th>
              <th>Amount</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Date Paid</th>
              <th>Method</th>
              <th>Staff</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
}

function manualTallyByText(monthText) {
  // Parse monthText to 'YYYY-MM'
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var year, monthNum;
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    year = Number(parts[0]);
    monthNum = Number(parts[1]) - 1;
  } else if (/^[A-Za-z]+ \d{4}$/.test(monthText)) { // 'May 2025'
    var parts = monthText.trim().split(' ');
    monthNum = monthNames.indexOf(parts[0]);
    year = Number(parts[1]);
  } else {
    throw new Error('Invalid monthText format: ' + monthText);
  }
  var monthStr = year + '-' + ('0' + (monthNum + 1)).slice(-2);

  // 1. Fetch all events for that month from the calendar
  var events = getLessonEventsForMonth(monthText);

  // 2. Store all events in ManualTally
  var ss = SpreadsheetApp.openById(SS_ID);
  var manualSheet = ss.getSheetByName('ManualTally');
  if (!manualSheet) manualSheet = ss.insertSheet('ManualTally');
  // Write headers if empty
  if (manualSheet.getLastRow() === 0) {
    manualSheet.appendRow(['EventID', 'Title', 'Start', 'End', 'StudentName', 'IsKidsLesson']);
  }
  // Clear previous data for this month
  var allRows = manualSheet.getDataRange().getValues();
  var headerLen = allRows[0].length;
  var rowsToKeep = [allRows[0]];
  for (var i = 1; i < allRows.length; i++) {
    var row = allRows[i];
    var eventDate = row[2];
    if (eventDate && eventDate instanceof Date) {
      var rowMonth = eventDate.getFullYear() + '-' + ('0' + (eventDate.getMonth() + 1)).slice(-2);
      if (rowMonth !== monthStr) rowsToKeep.push(row);
    }
  }
  manualSheet.clear();
  manualSheet.getRange(1, 1, rowsToKeep.length, headerLen).setValues(rowsToKeep);

  // Add new events for this month
  var validRows = [];
  events.forEach(function(event) {
    var title = event.getTitle();
    // Ignore teacher breaks (case-insensitive 'break' or 'Teacher' in title)
    if (/break/i.test(title) || /teacher/i.test(title)) return;
    if (!isValidLessonEvent_(event)) return;
    
    // Check if title contains '子' marker BEFORE removing it
    var isKidsLesson = /子/.test(title);
    
    // Extract the part before the first parenthesis
    var namePart = title.split('(')[0];
    namePart = namePart.replace(/子/g, '');  // Remove AFTER detecting
    var names = namePart.split(/\s+and\s+/i).map(function(n) { return n.trim(); }).filter(Boolean);
    var lastName = '';
    if (names.length > 1) {
      var lastParts = names[names.length - 1].split(/\s+/);
      if (lastParts.length > 1) {
        lastName = lastParts[lastParts.length - 1];
      }
    }
    for (var i = 0; i < names.length; i++) {
      var parts = names[i].split(/\s+/);
      if (parts.length > 1) {
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          names[i],
          isKidsLesson ? '子' : ''  // NEW COLUMN
        ]);
      } else {
        var fullName = parts[0] + (lastName ? ' ' + lastName : '');
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          fullName.trim(),
          isKidsLesson ? '子' : ''  // NEW COLUMN
        ]);
      }
    }
  });
  if (validRows.length > 0) {
    manualSheet.getRange(manualSheet.getLastRow() + 1, 1, validRows.length, 6).setValues(validRows);
  }

  // 3. Count and store in Stats
  var statsSheet = ss.getSheetByName('Stats');
  if (!statsSheet) statsSheet = ss.insertSheet('Stats');
  if (statsSheet.getLastRow() === 0) statsSheet.appendRow(['Month', 'Lessons']);
  var statsData = statsSheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < statsData.length; i++) {
    if (statsData[i][0] === monthStr) {
      statsSheet.getRange(i+1, 2).setValue(validRows.length);
      found = true;
      break;
    }
  }
  if (!found) {
    statsSheet.appendRow([monthStr, validRows.length]);
  }
}

function manualTally() {
  manualTallyByText('June 2025');
}

function getTotalStudents() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(STUDENT_SHEET);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idIdx = headers.indexOf('ID');
  var statusIdx = headers.indexOf('Status');
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var id = data[i][idIdx];
    var status = (data[i][statusIdx] || '').toString().trim().toUpperCase();
    if (!id || id == 1 || status === '' || status === 'DEMO' || status === '1') continue;
    count++;
  }
  return count;
}

function logLessonsLastMonthForDashboard() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lessonsLastMonth = 0;
  for (var i = 1; i < stats.length; i++) {
    if ((stats[i][0] + '').trim() === lastMonth) lessonsLastMonth = Number(stats[i][1]);
  }
  Logger.log('Lessons last month (' + lastMonth + '): ' + lessonsLastMonth);
}

function getLessonsLastMonthForDashboard() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lessonsLastMonth = 0;
  for (var i = 1; i < stats.length; i++) {
    if ((stats[i][0] + '').trim() === lastMonth) lessonsLastMonth = Number(stats[i][1]);
  }
  return lessonsLastMonth;
}

function logAllLessonsColumnFromStats() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var statsSheet = ss.getSheetByName('Stats');
  if (!statsSheet) {
    Logger.log('Stats sheet not found.');
    return;
  }
  var stats = statsSheet.getDataRange().getValues();
  Logger.log('All values in column B (Lessons) of Stats:');
  for (var i = 1; i < stats.length; i++) {
    Logger.log('Row ' + (i+1) + ': ' + stats[i][1]);
  }
}

function getBookedLessons(studentId, year, monthName) {
  var ss     = SpreadsheetApp.openById(SS_ID);
  var sh     = ss.getSheetByName(LESSON_SHEET);
  var data   = sh.getDataRange().getDisplayValues();
  var headers= data.shift();                // remove header row
  var idxId  = headers.indexOf('Student ID');
  var idxMon = headers.indexOf('Month');
  var idxBkd = headers.indexOf('Booked');
  var count  = 0;

  // build the "MMMM yyyy" string we store in the sheet, e.g. "May 2025"
  var target = monthName + ' ' + year;

  data.forEach(function(row){
    if (String(row[idxId]) === String(studentId)
       && String(row[idxMon]).trim() === target) {
      count = Number(row[idxBkd]) || 0;
    }
  });
  return count;
}

function renderPaymentLogs() {
  return HtmlService.createHtmlOutputFromFile('PaymentLogs').getContent();
}

function getDashboardStatsForCards() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // Lessons this month and students this month from MonthlySchedule
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  var lessonsThisMonth = 0;
  var studentSet = new Set();
  if (cacheSheet) {
    var data = cacheSheet.getDataRange().getValues();
    lessonsThisMonth = data.length >= 2 ? (data.length - 1) : 0;
    if (data.length >= 2) {
      var headers = data[0];
      var studentNameIdx = headers.indexOf('StudentName');
      for (var i = 1; i < data.length; i++) {
        var studentCell = data[i][studentNameIdx];
        if (studentCell) {
          var names = studentCell.split(/\s+and\s+/i).map(function(n) { return n.trim(); }).filter(Boolean);
          names.forEach(function(name) {
            if (name) studentSet.add(name);
          });
        }
      }
    }
  }
  var studentsThisMonth = studentSet.size;

  // Lessons last month from Stats
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lastMonthLabel = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'MMMM yyyy');
  var lessonsLastMonth = 0;
  for (var i = 1; i < stats.length; i++) {
    var monthCell = stats[i][0];
    var monthStr;
    if (monthCell instanceof Date) {
      monthStr = Utilities.formatDate(monthCell, Session.getScriptTimeZone(), 'yyyy-MM');
    } else {
      monthStr = (monthCell + '').trim();
    }
    if (monthStr === lastMonth) lessonsLastMonth = Number(stats[i][1]);
  }
  var diff = lessonsThisMonth - lessonsLastMonth;
  var lessonsDiff = (diff >= 0 ? '+' : '') + diff + ' this month';

  return {
    lessonsThisMonth: lessonsThisMonth,
    studentsThisMonth: studentsThisMonth,
    lessonsLastMonth: lessonsLastMonth,
    lastMonthLabel: lastMonthLabel,
    lessonsDiff: lessonsDiff
  };
}

function getPaymentsForCurrentYear() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var studentSheet = ss.getSheetByName('Students');
  var paymentData = paymentSheet.getDataRange().getValues();
  var paymentHeaders = paymentData[0];
  var studentData = studentSheet.getDataRange().getValues();
  var studentHeaders = studentData[0];
  var studentIdIdx = studentHeaders.indexOf('ID');
  var studentNameIdx = studentHeaders.indexOf('Name');
  var yearIdx = paymentHeaders.indexOf('Year');
  var studentIdPaymentIdx = paymentHeaders.indexOf('Student ID');
  var currentYear = new Date().getFullYear().toString();

  // Build a map of studentId -> studentName
  var studentMap = {};
  for (var i = 1; i < studentData.length; i++) {
    studentMap[studentData[i][studentIdIdx]] = studentData[i][studentNameIdx];
  }

  var result = [];
  for (var i = 1; i < paymentData.length; i++) {
    if (String(paymentData[i][yearIdx]) === currentYear) {
      var obj = {};
      for (var j = 0; j < paymentHeaders.length; j++) {
        obj[paymentHeaders[j]] = paymentData[i][j];
      }
      // Add studentName field
      obj['studentName'] = studentMap[obj['Student ID']] || '';
      result.push(obj);
    }
  }
  Logger.log('Payments found for year ' + currentYear + ': ' + result.length);
  if (result.length > 0) {
    Logger.log('First payment entry: ' + JSON.stringify(result[0]));
  }
  return result;
}

function getStudentsWithLessonsToday() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) return [];

  var data = cacheSheet.getDataRange().getValues();
  if (data.length < 2) return []; // Not enough data

  var headers = data[0];
  var studentNameIdx = headers.indexOf('StudentName');
  var eventTitleIdx = headers.indexOf('Title');
  var eventStartIdx = headers.indexOf('Start');
  var eventEndIdx = headers.indexOf('End');
  var statusIdx = headers.indexOf('Status');

  var today = new Date();
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var students = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var eventDate = row[eventStartIdx];
    var eventDateStr = '';
    if (eventDate instanceof Date) {
      eventDateStr = Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (eventDateStr === todayStr) {
      students.push({
        Name: row[studentNameIdx],
        Status: row[statusIdx],
        EventStart: row[eventStartIdx],
        EventEnd: row[eventEndIdx],
        EventTitle: row[eventTitleIdx]
      });
    }
  }
  return students;
}

function getDashboardStats() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // Lessons booked this month
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  var lessonsThisMonth = 0;
  var studentSet = new Set();
  if (cacheSheet) {
    var data = cacheSheet.getDataRange().getValues();
    lessonsThisMonth = data.length >= 2 ? (data.length - 1) : 0;
    if (data.length >= 2) {
      var headers = data[0];
      var studentNameIdx = headers.indexOf('StudentName');
      for (var i = 1; i < data.length; i++) {
        var studentCell = data[i][studentNameIdx];
        if (studentCell) {
          var names = studentCell.split(/\s+and\s+/i).map(function(n) { return n.trim(); }).filter(Boolean);
          names.forEach(function(name) {
            if (name) studentSet.add(name);
          });
        }
      }
    }
  }
  var studentsThisMonth = studentSet.size;

  // Last month's lessons
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lessonsLastMonth = 0;
  for (var i = 1; i < stats.length; i++) {
    var monthCell = stats[i][0];
    var monthStr;
    if (monthCell instanceof Date) {
      monthStr = Utilities.formatDate(monthCell, Session.getScriptTimeZone(), 'yyyy-MM');
    } else {
      monthStr = (monthCell + '').trim();
    }
    if (monthStr === lastMonth) lessonsLastMonth = Number(stats[i][1]);
  }
  var diff = lessonsThisMonth - lessonsLastMonth;
  var diffText = (diff >= 0 ? '+' : '') + diff + ' this month';

  // Total fees paid this year
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var paymentData = paymentSheet ? paymentSheet.getDataRange().getValues() : [];
  var paymentHeaders = paymentData[0] || [];
  var yearIdx = paymentHeaders.indexOf('Year');
  var totalIdx = paymentHeaders.indexOf('Total');
  var currentYear = new Date().getFullYear().toString();
  var totalFeesPaid = 0;
  for (var i = 1; i < paymentData.length; i++) {
    if (String(paymentData[i][yearIdx]) === currentYear) {
      var val = paymentData[i][totalIdx];
      if (val && !isNaN(val)) totalFeesPaid += Number(val);
    }
  }

  return {
    lessonsThisMonth: lessonsThisMonth,
    studentsThisMonth: studentsThisMonth,
    diffText: diffText,
    totalFeesPaid: totalFeesPaid
  };
}

function getDashboardStatsForClient() {
  return getDashboardStats();
}

function normalizeMonthValue(val) {
  if (val === null || val === undefined) return null;
  var s = String(val).trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    var num = parseInt(s, 10);
    if (num >= 1 && num <= 12) return num;
  }
  var map = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };
  return map[s] || map[s.slice(0, 3)] || null;
}

function monthNameFromAny(val) {
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var num = normalizeMonthValue(val);
  if (num) return months[num - 1];
  var s = String(val || '').toLowerCase();
  for (var i = 0; i < months.length; i++) {
    var m = months[i].toLowerCase();
    if (s.indexOf(m) !== -1) return months[i];
  }
  return String(val || '').trim();
}

function monthNumberFromText(val) {
  var name = monthNameFromAny(val);
  if (!name) return null;
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var idx = months.indexOf(name);
  return idx >= 0 ? idx + 1 : null;
}

function getUnpaidStudentsThisMonth(selectedMonth, selectedYear) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var studentsSheet = ss.getSheetByName('Students');

  var today = new Date();
  var tz = Session.getScriptTimeZone();

  // Resolve target month/year from caller or default to "now" (script TZ)
  var targetYear = String(selectedYear || Utilities.formatDate(today, tz, 'yyyy')).trim();
  var targetMonthNum = normalizeMonthValue(selectedMonth);
  if (!targetMonthNum) {
    targetMonthNum = today.getMonth() + 1; // 1-12
  }
  var targetKey = targetYear + '-' + ('0' + targetMonthNum).slice(-2); // YYYY-MM

  // Build a map of student name -> ID from Students sheet
  var studentsData = studentsSheet.getDataRange().getValues();
  var studentsHeaders = studentsData[0];
  var idxStuId = studentsHeaders.indexOf('ID');
  var idxStuName = studentsHeaders.indexOf('Name');
  var nameToId = {};
  for (var i = 1; i < studentsData.length; i++) {
    var name = (studentsData[i][idxStuName] || '').trim();
    var id = (studentsData[i][idxStuId] || '').toString().trim();
    if (name && id) nameToId[name] = id;
  }

  // Get all events for this month from MonthlySchedule
  var cacheData = cacheSheet.getDataRange().getValues();
  if (cacheData.length < 2) return [];
  var headers = cacheData[0];
  var studentNameIdx = headers.indexOf('StudentName');
  var eventStartIdx = headers.indexOf('Start');

  // Build a set of Student IDs with events this month
  var eventStudentIds = new Set();
  for (var i = 1; i < cacheData.length; i++) {
    var row = cacheData[i];
    var studentName = (row[studentNameIdx] || '').trim();
    var eventStart = row[eventStartIdx];
    if (!studentName || !eventStart) continue;
    var eventDate = eventStart instanceof Date ? eventStart : new Date(eventStart);
    var eventMonthNum = eventDate.getMonth() + 1;
    var eventYear = Utilities.formatDate(eventDate, tz, 'yyyy');
    var eventKey = eventYear + '-' + ('0' + eventMonthNum).slice(-2);
    if (eventKey === targetKey) {
      // Handle group lessons (split by ' and ')
      studentName.split(/\s+and\s+/i).forEach(function(name) {
        name = name.trim();
        var id = nameToId[name];
        if (id) eventStudentIds.add(id);
      });
    }
  }

  // Get all payments for this month
  var paymentData = paymentSheet.getDataRange().getValues();
  var paymentHeaders = paymentData[0];
  var idxPayId = paymentHeaders.indexOf('Student ID');
  var idxPayMonth = paymentHeaders.indexOf('Month');
  var idxPayYear = paymentHeaders.indexOf('Year');
  var paidSet = new Set();
  for (var i = 1; i < paymentData.length; i++) {
    var row = paymentData[i];
    var payMonthNum = normalizeMonthValue(row[idxPayMonth]);
    var payYear = (row[idxPayYear] || '').toString().trim();
    var payKey = payYear && payMonthNum ? payYear + '-' + ('0' + payMonthNum).slice(-2) : '';
    if (payKey === targetKey) {
      paidSet.add((row[idxPayId] || '').toString().trim());
    }
  }

  // Build unpaid list
  var unpaid = [];
  eventStudentIds.forEach(function(id) {
    if (!paidSet.has(id)) {
      // Find name for this ID
      var name = '';
      for (var n in nameToId) {
        if (nameToId[n] === id) { name = n; break; }
      }
      unpaid.push({
        'Student ID': id,
        'Student Name': name,
        'Year': currentYear,
        'Month': currentMonth
      });
    }
  });

  return unpaid;
}

function getPaymentLogs() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(PAYMENT_SHEET);
  var data = sh.getDataRange().getDisplayValues();
  var headers = data.shift(); // Remove header row
  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getUnpaidStudentsFromSheet() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Unpaid');
  var data = sh.getDataRange().getDisplayValues();
  var headers = data.shift(); // Remove header row
  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function tallyStatsFromFeb2020() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) cacheSheet = ss.insertSheet('MonthlySchedule');

  var startYear = 2020;
  var startMonth = 2; // February
  var now = new Date();
  var endYear = now.getFullYear();
  var endMonth = now.getMonth() + 1; // JS months are 0-based

  for (var year = startYear; year <= endYear; year++) {
    var monthStart = (year === startYear) ? startMonth : 1;
    var monthEnd = (year === endYear) ? endMonth : 12;
    for (var month = monthStart; month <= monthEnd; month++) {
      var monthStr = year + '-' + ('0' + month).slice(-2);
      // Fill MonthlySchedule for this month
      cacheMonthlyEvents(monthStr);
      // Set A1 to the month (redundant if cacheMonthlyEvents does this, but safe)
      cacheSheet.getRange('A1').setValue(monthStr);
      // Tally stats for this month
      tallyLessonsForMonthAndStore(monthStr);
    }
  }
}

/**
 * Get available time slots for a week, filtered by teacher availability and existing lessons
 * @param {string} weekStartISO - ISO string of Monday of the week (e.g., "2024-01-15T00:00:00.000Z")
 * @param {string} studentId - Student ID (optional - only used for logging/context, not for filtering)
 * @param {Array} teacherFilter - Array of teacher names (optional - if provided, only show slots where these teachers are available)
 * @returns {string} JSON string of available slots by date and time
 */
/**
 * Get cached teacher schedule for a specific date
 * @param {string} dateStr - Date in format 'YYYY-MM-DD'
 * @returns {Array} Array of schedule objects with {teacherName, startTime, endTime}
 */
function getCachedTeacherSchedule(dateStr) {
  try {
    Logger.log('=== getCachedTeacherSchedule called for date: ' + dateStr);
    var ss = SpreadsheetApp.openById(SS_ID);
    var cacheSheet = ss.getSheetByName('TeacherSchedules');
    
    if (!cacheSheet) {
      Logger.log('❌ TeacherSchedules sheet not found');
      return [];
    }
    
    Logger.log('✅ TeacherSchedules sheet found');
    var data = cacheSheet.getDataRange().getValues();
    Logger.log('Sheet has ' + data.length + ' rows (including header)');
    
    if (data.length < 2) {
      Logger.log('⚠️ TeacherSchedules sheet is empty (no data rows)');
      return [];
    }
    
    var headers = data[0];
    Logger.log('Headers: ' + JSON.stringify(headers));
    var dateIdx = headers.indexOf('Date');
    var teacherNameIdx = headers.indexOf('TeacherName');
    var startTimeIdx = headers.indexOf('StartTime');
    var endTimeIdx = headers.indexOf('EndTime');
    
    Logger.log('Column indices - Date: ' + dateIdx + ', TeacherName: ' + teacherNameIdx + ', StartTime: ' + startTimeIdx + ', EndTime: ' + endTimeIdx);
    
    if (dateIdx === -1 || teacherNameIdx === -1 || startTimeIdx === -1 || endTimeIdx === -1) {
      Logger.log('❌ Required columns not found in TeacherSchedules');
      Logger.log('Missing columns - Date: ' + (dateIdx === -1) + ', TeacherName: ' + (teacherNameIdx === -1) + ', StartTime: ' + (startTimeIdx === -1) + ', EndTime: ' + (endTimeIdx === -1));
      return [];
    }
    
    var schedules = [];
    var totalRows = 0;
    var matchingRows = 0;
    
    for (var i = 1; i < data.length; i++) {
      totalRows++;
      var row = data[i];
      var rowDateStr = '';
      
      // Handle date column - could be Date object or string
      var dateCell = row[dateIdx];
      if (dateCell instanceof Date) {
        rowDateStr = Utilities.formatDate(dateCell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        rowDateStr = String(dateCell || '').trim();
      }
      
      // Log first few rows for debugging
      if (i <= 3) {
        Logger.log('Row ' + i + ' - Date cell: ' + dateCell + ' (type: ' + typeof dateCell + '), formatted: ' + rowDateStr + ', target: ' + dateStr);
      }
      
      if (rowDateStr === dateStr) {
        matchingRows++;
        
        // Handle StartTime and EndTime - could be Date object or string
        var startTimeCell = row[startTimeIdx];
        var endTimeCell = row[endTimeIdx];
        var startTimeStr = '';
        var endTimeStr = '';
        
        if (startTimeCell instanceof Date) {
          startTimeStr = Utilities.formatDate(startTimeCell, Session.getScriptTimeZone(), 'HH:mm');
        } else {
          startTimeStr = String(startTimeCell || '').trim();
        }
        
        if (endTimeCell instanceof Date) {
          endTimeStr = Utilities.formatDate(endTimeCell, Session.getScriptTimeZone(), 'HH:mm');
        } else {
          endTimeStr = String(endTimeCell || '').trim();
        }
        
        var schedule = {
          teacherName: String(row[teacherNameIdx] || '').trim(),
          startTime: startTimeStr,
          endTime: endTimeStr
        };
        schedules.push(schedule);
        
        if (matchingRows <= 3) {
          Logger.log('✅ Match found - Teacher: ' + schedule.teacherName + ', Shift: ' + schedule.startTime + ' - ' + schedule.endTime);
        }
      }
    }
    
    Logger.log('Total rows checked: ' + totalRows + ', Matching rows for ' + dateStr + ': ' + matchingRows);
    Logger.log('Returning ' + schedules.length + ' schedules');
    
    return schedules;
    
  } catch (error) {
    Logger.log('❌ Error in getCachedTeacherSchedule: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

/**
 * Sync teacher schedules from calendar IDs into TeacherSchedules.
 * Source: Code sheet, columns A (CalendarID) and B (TeacherName), rows starting at 2.
 * Writes rows into TeacherSchedules with columns: Date, TeacherName, StartTime, EndTime.
 * Window: current month + next month.
 */
function syncTeacherSchedulesFromCalendars() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var codeSheet = ss.getSheetByName('Code');
    if (!codeSheet) {
      Logger.log('❌ Code sheet not found');
      return 0;
    }
    var data = codeSheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('⚠️ Code sheet has no calendar rows');
      return 0;
    }
    var calendars = [];
    for (var i = 1; i < data.length; i++) {
      var calId = String(data[i][0] || '').trim();
      var teacherName = String(data[i][1] || '').trim();
      if (calId && teacherName) {
        calendars.push({ id: calId, teacherName: teacherName });
      }
    }

    // Deduplicate
    if (calendars.length) {
      var seen = {};
      calendars = calendars.filter(function(entry){
        var key = entry.id + '|' + entry.teacherName;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    if (!calendars.length) {
      Logger.log('⚠️ No valid teacher calendars found in Code sheet.');
      return 0;
    }
    
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var windowEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1); // current + next month
    
    var rows = [];
    calendars.forEach(function(calEntry) {
      var cal = CalendarApp.getCalendarById(calEntry.id);
      if (!cal) {
        Logger.log('⚠️ Calendar not found: ' + calEntry.id);
        return;
      }
      var events = cal.getEvents(windowStart, windowEnd);
      Logger.log('Found ' + events.length + ' events for calendar ' + calEntry.id);
      events.forEach(function(ev) {
        if (ev.isAllDayEvent()) return;
        var st = ev.getStartTime();
        var et = ev.getEndTime();
        rows.push([
          Utilities.formatDate(st, tz, 'yyyy-MM-dd'),
          calEntry.teacherName,
          Utilities.formatDate(st, tz, 'HH:mm'),
          Utilities.formatDate(et, tz, 'HH:mm')
        ]);
      });
    });
    
    var schedSheet = ss.getSheetByName('TeacherSchedules');
    if (!schedSheet) {
      schedSheet = ss.insertSheet('TeacherSchedules');
    }
    var headers = ['Date', 'TeacherName', 'StartTime', 'EndTime'];
    var existing = schedSheet.getDataRange().getValues();
    var keepRows = [];
    if (existing.length > 1) {
      var h = existing[0];
      var dIdx = h.indexOf('Date');
      var tIdx = h.indexOf('TeacherName');
      var sIdx = h.indexOf('StartTime');
      var eIdx = h.indexOf('EndTime');
      if (dIdx !== -1 && tIdx !== -1 && sIdx !== -1 && eIdx !== -1) {
        for (var r = 1; r < existing.length; r++) {
          var row = existing[r];
          var dCell = row[dIdx];
          var dStr = dCell instanceof Date ? Utilities.formatDate(dCell, tz, 'yyyy-MM-dd') : String(dCell || '').trim();
          var dDate = new Date(dStr + 'T00:00:00');
          if (isNaN(dDate.getTime())) continue;
          if (dDate < windowStart || dDate >= windowEnd) {
            keepRows.push(row);
          }
        }
      }
    }
    
    schedSheet.clear();
    schedSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var out = keepRows.concat(rows);
    if (out.length > 0) {
      schedSheet.getRange(2, 1, out.length, headers.length).setValues(out);
    }
    Logger.log('✅ Synced teacher schedules from calendars. New rows: ' + rows.length + ', kept rows: ' + keepRows.length);
    return rows.length;
  } catch (e) {
    Logger.log('❌ Error in syncTeacherSchedulesFromCalendars: ' + e.toString());
    return 0;
  }
}

/**
 * Get available teachers for a specific date and time
 * @param {Date} dateTime - Date and time object
 * @param {number} durationMinutes - Duration of lesson in minutes (default 50)
 * @returns {Array} Array of teacher names available at that time
 */
function getAvailableTeachersForTime(dateTime, durationMinutes) {
  try {
    var dateStr = Utilities.formatDate(dateTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(dateTime, Session.getScriptTimeZone(), 'HH:mm');
    
    // Calculate end time
    var endDateTime = new Date(dateTime.getTime() + (durationMinutes || 50) * 60 * 1000);
    var endTimeStr = Utilities.formatDate(endDateTime, Session.getScriptTimeZone(), 'HH:mm');
    
    var schedules = getCachedTeacherSchedule(dateStr);
    
    var availableTeachers = [];
    
    schedules.forEach(function(schedule) {
      // Check if the requested time falls within working hours
      // Normalize time strings for comparison (handle both "HH:mm" and "HH:mm:ss" formats)
      var normalizedStartTime = String(schedule.startTime || '').trim().substring(0, 5); // Take first 5 chars (HH:mm)
      var normalizedEndTime = String(schedule.endTime || '').trim().substring(0, 5);
      var normalizedTimeStr = String(timeStr || '').trim().substring(0, 5);
      var normalizedEndTimeStr = String(endTimeStr || '').trim().substring(0, 5);
      
      if (normalizedTimeStr >= normalizedStartTime && normalizedEndTimeStr <= normalizedEndTime) {
        availableTeachers.push(schedule.teacherName);
      }
    });
    
    return availableTeachers;
    
  } catch (error) {
    Logger.log('Error in getAvailableTeachersForTime: ' + error.toString());
    return [];
  }
}

// ============================================================================
// BOOKING AVAILABILITY CACHE SYSTEM
// ============================================================================

/**
 * Initialize or get the BookingAvailability sheet
 * @returns {Sheet} The BookingAvailability sheet
 */
function getBookingAvailabilitySheet() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('BookingAvailability');
  
  if (!sheet) {
    // Create the sheet
    sheet = ss.insertSheet('BookingAvailability');
    
    // Set headers
    var headers = [
      'Date',           // YYYY-MM-DD
      'Time',           // HH:mm
      'TeacherCount',   // Number of teachers available
      'LessonCount',    // Number of scheduled lessons
      'AvailableSlots', // TeacherCount - LessonCount
      'Teachers',       // Comma-separated list of teacher names
      'HasKidsLesson',  // Boolean: true if any lesson is kids lesson
      'HasAdultLesson', // Boolean: true if any lesson is adult lesson
      'Reason',         // no-teachers | fully-booked | '' when available
      'LastUpdated'     // Timestamp of last update
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Set data validation and formatting
    var dateRange = sheet.getRange('A:A');
    dateRange.setNumberFormat('yyyy-mm-dd');
    
    var timeRange = sheet.getRange('B:B');
    timeRange.setNumberFormat('hh:mm');
    
  var lastUpdatedRange = sheet.getRange('J:J');
    lastUpdatedRange.setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  
  return sheet;
}

/**
 * Calculate and store availability for a specific week
 * @param {Date} weekStart - Monday of the week
 * @param {boolean} forceRecalculate - Force recalculation even if data exists
 */
function calculateAndStoreWeekAvailability(weekStart, forceRecalculate) {
  try {
    // Normalize weekStart to Monday at midnight
    var normalizedWeekStart = new Date(weekStart);
    var dayOfWeek = normalizedWeekStart.getDay();
    var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    normalizedWeekStart.setDate(normalizedWeekStart.getDate() + daysToMonday);
    normalizedWeekStart.setHours(0, 0, 0, 0);
    
    var sheet = getBookingAvailabilitySheet();
    var tz = Session.getScriptTimeZone();
    var timeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    
    // Check if we need to recalculate
    if (!forceRecalculate) {
      var weekEnd = new Date(normalizedWeekStart);
      weekEnd.setDate(normalizedWeekStart.getDate() + 7);
      var weekStartStr = Utilities.formatDate(normalizedWeekStart, tz, 'yyyy-MM-dd');
      var weekEndStr = Utilities.formatDate(weekEnd, tz, 'yyyy-MM-dd');
      
      // Check if data exists for this week
      var data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        var dateCol = 0; // Column A
        var lastUpdatedCol = 8; // Column I
        var hasDataForWeek = false;
        var oldestUpdate = null;
        
        for (var i = 1; i < data.length; i++) {
          var rowDate = data[i][dateCol];
          if (rowDate instanceof Date) {
            var rowDateStr = Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd');
            if (rowDateStr >= weekStartStr && rowDateStr < weekEndStr) {
              hasDataForWeek = true;
              var lastUpdated = data[i][lastUpdatedCol];
              if (lastUpdated instanceof Date) {
                if (!oldestUpdate || lastUpdated < oldestUpdate) {
                  oldestUpdate = lastUpdated;
                }
              }
            }
          }
        }
        
        // If data exists and is less than 1 hour old, skip recalculation
        if (hasDataForWeek && oldestUpdate) {
          var oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (oldestUpdate > oneHourAgo) {
            Logger.log('Skipping recalculation - data is fresh for week starting ' + weekStartStr);
            return;
          }
        }
      }
    }
    
    // Delete existing data for this week
    var weekEnd = new Date(normalizedWeekStart);
    weekEnd.setDate(normalizedWeekStart.getDate() + 7);
    var weekStartStr = Utilities.formatDate(normalizedWeekStart, tz, 'yyyy-MM-dd');
    var weekEndStr = Utilities.formatDate(weekEnd, tz, 'yyyy-MM-dd');
    
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      var rowDate = data[i][0];
      if (rowDate instanceof Date) {
        var rowDateStr = Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd');
        if (rowDateStr >= weekStartStr && rowDateStr < weekEndStr) {
          rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
        }
      }
    }
    
    // Delete rows from bottom to top to maintain indices
    for (var i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
    }
    
    // Get teacher schedules for the week
    var teacherSchedulesByDate = {};
    var ss = SpreadsheetApp.openById(SS_ID);
    var teacherScheduleSheet = ss.getSheetByName('TeacherSchedules');
    
    if (teacherScheduleSheet) {
      var scheduleData = teacherScheduleSheet.getDataRange().getValues();
      if (scheduleData.length > 1) {
        var headers = scheduleData[0];
        var dateIdx = headers.indexOf('Date');
        var teacherNameIdx = headers.indexOf('TeacherName');
        var startTimeIdx = headers.indexOf('StartTime');
        var endTimeIdx = headers.indexOf('EndTime');
        
        if (dateIdx !== -1 && teacherNameIdx !== -1 && startTimeIdx !== -1 && endTimeIdx !== -1) {
          for (var i = 1; i < scheduleData.length; i++) {
            var row = scheduleData[i];
            var rowDate = row[dateIdx];
            var rowDateStr = '';
            
            if (rowDate instanceof Date) {
              rowDateStr = Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd');
            } else {
              rowDateStr = String(rowDate || '').trim();
            }
            
            if (rowDateStr >= weekStartStr && rowDateStr < weekEndStr) {
              if (!teacherSchedulesByDate[rowDateStr]) {
                teacherSchedulesByDate[rowDateStr] = [];
              }
              
              var startTime = row[startTimeIdx];
              var endTime = row[endTimeIdx];
              var startTimeStr = '';
              var endTimeStr = '';
              
              if (startTime instanceof Date) {
                startTimeStr = Utilities.formatDate(startTime, tz, 'HH:mm');
              } else {
                startTimeStr = String(startTime || '').trim().substring(0, 5);
              }
              
              if (endTime instanceof Date) {
                endTimeStr = Utilities.formatDate(endTime, tz, 'HH:mm');
              } else {
                endTimeStr = String(endTime || '').trim().substring(0, 5);
              }
              
              teacherSchedulesByDate[rowDateStr].push({
                teacherName: String(row[teacherNameIdx] || '').trim(),
                startTime: startTimeStr,
                endTime: endTimeStr
              });
            }
          }
        }
      }
    }
    
    // Get existing lessons for the week
    var existingLessonsMap = {};
    var monthlyScheduleSheet = ss.getSheetByName('MonthlySchedule');
    
    if (monthlyScheduleSheet) {
      var lessonData = monthlyScheduleSheet.getDataRange().getValues();
      if (lessonData.length > 1) {
        var lessonHeaders = lessonData[0];
        var startIdx = lessonHeaders.indexOf('Start');
        var statusIdx = lessonHeaders.indexOf('Status');
        var isKidsLessonIdx = lessonHeaders.indexOf('IsKidsLesson');
        
        if (startIdx !== -1 && statusIdx !== -1) {
          for (var i = 1; i < lessonData.length; i++) {
            var row = lessonData[i];
            var startTime = row[startIdx];
            
            if (startTime instanceof Date) {
              var rowDateStr = Utilities.formatDate(startTime, tz, 'yyyy-MM-dd');
              var rowTimeStr = Utilities.formatDate(startTime, tz, 'HH:mm');
              var status = row[statusIdx] || 'scheduled';
              var isKidsLesson = row[isKidsLessonIdx] === '子' || row[isKidsLessonIdx] === true;
              
              if (rowDateStr >= weekStartStr && rowDateStr < weekEndStr && status === 'scheduled') {
                if (!existingLessonsMap[rowDateStr]) {
                  existingLessonsMap[rowDateStr] = {};
                }
                if (!existingLessonsMap[rowDateStr][rowTimeStr]) {
                  existingLessonsMap[rowDateStr][rowTimeStr] = [];
                }
                existingLessonsMap[rowDateStr][rowTimeStr].push({
                  isKidsLesson: isKidsLesson
                });
              }
            }
          }
        }
      }
    }
    
    // Calculate availability for each time slot
    var newRows = [];
    var now = new Date();
    
    for (var day = 0; day < 7; day++) {
      var dayDate = new Date(normalizedWeekStart);
      dayDate.setDate(normalizedWeekStart.getDate() + day);
      var dateStr = Utilities.formatDate(dayDate, tz, 'yyyy-MM-dd');
      
      for (var t = 0; t < timeSlots.length; t++) {
        var timeStr = timeSlots[t];
        
        // Get available teachers for this time slot
        var availableTeachers = [];
        var schedules = teacherSchedulesByDate[dateStr] || [];
        
        schedules.forEach(function(schedule) {
          var normalizedStartTime = String(schedule.startTime || '').trim().substring(0, 5);
          var normalizedEndTime = String(schedule.endTime || '').trim().substring(0, 5);
          var normalizedTimeStr = String(timeStr || '').trim().substring(0, 5);
          
          // Calculate end time for 50-minute lesson
          var timeParts = normalizedTimeStr.split(':');
          var hour = parseInt(timeParts[0]);
          var minute = parseInt(timeParts[1]);
          var endTimeDate = new Date(dayDate);
          endTimeDate.setHours(hour, minute + 50, 0, 0);
          var normalizedEndTimeStr = Utilities.formatDate(endTimeDate, tz, 'HH:mm');
          
          if (normalizedTimeStr >= normalizedStartTime && normalizedEndTimeStr <= normalizedEndTime) {
            availableTeachers.push(schedule.teacherName);
          }
        });
        
        var teacherCount = availableTeachers.length;
        
        // Get lesson count and kids/adults info
        var lessons = existingLessonsMap[dateStr] && existingLessonsMap[dateStr][timeStr] || [];
        var lessonCount = lessons.length;
        var hasKidsLesson = false;
        var hasAdultLesson = false;
        var reason = '';
        
        lessons.forEach(function(lesson) {
          if (lesson.isKidsLesson) {
            hasKidsLesson = true;
          } else {
            hasAdultLesson = true;
          }
        });
        
        var availableSlots = Math.max(0, teacherCount - lessonCount);
        if (availableSlots === 0) {
          if (teacherCount === 0) {
            reason = 'no-teachers';
          } else if (lessonCount >= teacherCount) {
            reason = 'fully-booked';
          }
        }
        
        // Create time value for the row
        var timeValue = new Date(dayDate);
        timeValue.setHours(parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), 0, 0);
        
        // Store the row
        newRows.push([
          dayDate,                                    // Date
          timeValue,                                  // Time
          teacherCount,                               // TeacherCount
          lessonCount,                                // LessonCount
          availableSlots,                             // AvailableSlots
          availableTeachers.join(','),                 // Teachers
          hasKidsLesson,                              // HasKidsLesson
          hasAdultLesson,                             // HasAdultLesson
          reason,                                     // Reason
          now                                         // LastUpdated
        ]);
      }
    }
    
    // Append all rows at once
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    
    Logger.log('Calculated and stored availability for week starting ' + weekStartStr + ' (' + newRows.length + ' time slots)');
    
  } catch (error) {
    Logger.log('Error calculating week availability: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Get availability for a week from BookingAvailability sheet
 * @param {string} weekStartISO - ISO string of Monday of the week
 * @param {string} studentId - Student ID (optional - for kids/adults filtering)
 * @param {Array} teacherFilter - Array of teacher names to filter by (optional)
 * @returns {string} JSON string of available slots
 */
function getAvailableSlotsForWeekFromCache(weekStartISO, studentId, teacherFilter) {
  try {
    var weekStart = new Date(weekStartISO);
    if (isNaN(weekStart.getTime())) {
      return JSON.stringify({ error: 'Invalid week start date' });
    }
    
    // Normalize to Monday
    var dayOfWeek = weekStart.getDay();
    var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    var sheet = getBookingAvailabilitySheet();
    var tz = Session.getScriptTimeZone();
    var weekStartStr = Utilities.formatDate(weekStart, tz, 'yyyy-MM-dd');
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    var weekEndStr = Utilities.formatDate(weekEnd, tz, 'yyyy-MM-dd');
    
    // Read all data
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      // No data - calculate it
      calculateAndStoreWeekAvailability(weekStart, false);
      data = sheet.getDataRange().getValues();
    }
    
    var headers = data[0];
    var dateCol = 0;
    var timeCol = 1;
    var teacherCountCol = 2;
    var lessonCountCol = 3;
    var availableSlotsCol = 4;
    var teachersCol = 5;
    var hasKidsLessonCol = 6;
    var hasAdultLessonCol = 7;
    
    // Check if student is a child
    var isChildStudent = false;
    if (studentId) {
      try {
        var student = getStudentById(studentId);
        if (student) {
          isChildStudent = !!(student['子'] === '子' || student.child === true || student.child === '子');
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Normalize teacher filter
    var normalizedTeacherFilter = null;
    if (teacherFilter && Array.isArray(teacherFilter) && teacherFilter.length > 0) {
      normalizedTeacherFilter = teacherFilter.map(function(name) {
        return String(name).trim();
      }).filter(function(name) {
        return name.length > 0;
      });
      if (normalizedTeacherFilter.length === 0) {
        normalizedTeacherFilter = null;
      }
    }
    
    // Build availability object
    var availableSlots = {};
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowDate = row[dateCol];
      
      if (!(rowDate instanceof Date)) continue;
      
      var rowDateStr = Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd');
      if (rowDateStr < weekStartStr || rowDateStr >= weekEndStr) continue;
      
      var rowTime = row[timeCol];
      var rowTimeStr = '';
      if (rowTime instanceof Date) {
        rowTimeStr = Utilities.formatDate(rowTime, tz, 'HH:mm');
      } else {
        rowTimeStr = String(rowTime || '').trim();
        if (rowTimeStr.length > 5) {
          rowTimeStr = rowTimeStr.substring(0, 5);
        }
      }
      
      if (!rowTimeStr) continue;
      
      var teacherCount = Number(row[teacherCountCol]) || 0;
      var lessonCount = Number(row[lessonCountCol]) || 0;
      var availableSlotsCount = Number(row[availableSlotsCol]) || 0;
      var teachersStr = String(row[teachersCol] || '');
      var teachers = teachersStr ? teachersStr.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; }) : [];
      var hasKidsLesson = row[hasKidsLessonCol] === true || row[hasKidsLessonCol] === 'TRUE';
      var hasAdultLesson = row[hasAdultLessonCol] === true || row[hasAdultLessonCol] === 'TRUE';
      
      // Filter for child students - hide slots with adult lessons
      if (isChildStudent && hasAdultLesson) {
        continue; // Skip this slot
      }
      
      // Apply teacher filter
      var filteredTeachers = teachers;
      var filteredTeacherCount = teacherCount;
      
      if (normalizedTeacherFilter && normalizedTeacherFilter.length > 0) {
        filteredTeachers = teachers.filter(function(teacher) {
          return normalizedTeacherFilter.indexOf(teacher) !== -1;
        });
        filteredTeacherCount = filteredTeachers.length;
        availableSlotsCount = Math.max(0, filteredTeacherCount - lessonCount);
      }
      
      var isAvailable = availableSlotsCount > 0;
      var reason = null;
      if (!isAvailable) {
        if (filteredTeacherCount === 0) {
          reason = normalizedTeacherFilter ? 'Selected teachers not available' : 'No teachers available';
        } else {
          reason = 'No available slots';
        }
      }
      
      if (!availableSlots[rowDateStr]) {
        availableSlots[rowDateStr] = {};
      }
      
      availableSlots[rowDateStr][rowTimeStr] = {
        available: isAvailable,
        teacherCount: filteredTeacherCount,
        lessonCount: lessonCount,
        availableSlots: availableSlotsCount,
        teachers: filteredTeachers,
        reason: reason
      };
    }
    
    return JSON.stringify(availableSlots);
    
  } catch (error) {
    Logger.log('Error getting availability from cache: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    // Fallback to old method
    try {
      return getAvailableSlotsForWeekOld(weekStartISO, studentId, teacherFilter);
    } catch (e) {
      Logger.log('Error in fallback method: ' + e.toString());
      return JSON.stringify({ error: 'Failed to get availability data' });
    }
  }
}

/**
 * Update availability for a specific time slot after lesson change
 * @param {Date} lessonDateTime - Date and time of the lesson
 * @param {boolean} isBooking - true if booking, false if cancelling
 * @param {boolean} isKidsLesson - true if kids lesson
 */
function updateAvailabilityForTimeSlot(lessonDateTime, isBooking, isKidsLesson) {
  try {
    var tz = Session.getScriptTimeZone();
    var dateStr = Utilities.formatDate(lessonDateTime, tz, 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(lessonDateTime, tz, 'HH:mm');
    
    var sheet = getBookingAvailabilitySheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      // No data - recalculate the week
      var weekStart = new Date(lessonDateTime);
      var dayOfWeek = weekStart.getDay();
      var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
      weekStart.setDate(weekStart.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);
      calculateAndStoreWeekAvailability(weekStart, true);
      return;
    }
    
    var dateCol = 0;
    var timeCol = 1;
    var lessonCountCol = 3;
    var availableSlotsCol = 4;
    var hasKidsLessonCol = 6;
    var hasAdultLessonCol = 7;
    var lastUpdatedCol = 8;
    
    // Find the row
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowDate = row[dateCol];
      
      if (!(rowDate instanceof Date)) continue;
      
      var rowDateStr = Utilities.formatDate(rowDate, tz, 'yyyy-MM-dd');
      if (rowDateStr !== dateStr) continue;
      
      var rowTime = row[timeCol];
      var rowTimeStr = '';
      if (rowTime instanceof Date) {
        rowTimeStr = Utilities.formatDate(rowTime, tz, 'HH:mm');
      } else {
        rowTimeStr = String(rowTime || '').trim();
        if (rowTimeStr.length > 5) {
          rowTimeStr = rowTimeStr.substring(0, 5);
        }
      }
      if (rowTimeStr !== timeStr) continue;
      
      // Found the row - update it
      var lessonCount = Number(row[lessonCountCol]) || 0;
      var teacherCount = Number(row[2]) || 0; // TeacherCount column
      
      if (isBooking) {
        lessonCount++;
      } else {
        lessonCount = Math.max(0, lessonCount - 1);
      }
      
      var availableSlots = Math.max(0, teacherCount - lessonCount);
      var hasKidsLessonValue = row[hasKidsLessonCol] === true || row[hasKidsLessonCol] === 'TRUE';
      var hasAdultLessonValue = row[hasAdultLessonCol] === true || row[hasAdultLessonCol] === 'TRUE';
      
      if (isBooking) {
        if (isKidsLesson) {
          hasKidsLessonValue = true;
        } else {
          hasAdultLessonValue = true;
        }
      } else {
        // When cancelling, we need to recalculate the whole week to get accurate kids/adults status
        var weekStart = new Date(lessonDateTime);
        var dayOfWeek = weekStart.getDay();
        var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        weekStart.setDate(weekStart.getDate() + daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        calculateAndStoreWeekAvailability(weekStart, true);
        return;
      }
      
      // Update the row
      sheet.getRange(i + 1, lessonCountCol + 1).setValue(lessonCount);
      sheet.getRange(i + 1, availableSlotsCol + 1).setValue(availableSlots);
      sheet.getRange(i + 1, hasKidsLessonCol + 1).setValue(hasKidsLessonValue);
      sheet.getRange(i + 1, hasAdultLessonCol + 1).setValue(hasAdultLessonValue);
      sheet.getRange(i + 1, lastUpdatedCol + 1).setValue(new Date());
      
      return;
    }
    
    // Row not found - recalculate the week
    var weekStart = new Date(lessonDateTime);
    var dayOfWeek = weekStart.getDay();
    var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    calculateAndStoreWeekAvailability(weekStart, true);
    
  } catch (error) {
    Logger.log('Error updating availability: ' + error.toString());
  }
}

/**
 * Refresh availability for next 6 weeks (background job)
 */
function refreshBookingAvailabilityCache() {
  try {
    // Sync teacher schedules from calendar IDs before calculating availability
    try {
      syncTeacherSchedulesFromCalendars();
    } catch (e) {
      Logger.log('Warning: syncTeacherSchedulesFromCalendars failed: ' + e.toString());
    }

    var now = new Date();
    var currentWeekStart = new Date(now);
    var dayOfWeek = currentWeekStart.getDay();
    var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Refresh current week and next 7 weeks (cover current + next month)
    for (var week = 0; week < 8; week++) {
      var weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (week * 7));
      calculateAndStoreWeekAvailability(weekStart, false);
    }
    
    Logger.log('Refreshed booking availability cache for 8 weeks');
  } catch (error) {
    Logger.log('Error refreshing availability cache: ' + error.toString());
  }
}

/**
 * Remove availability rows that are in the past (Date+Time earlier than now).
 * Intended to be run hourly to keep BookingAvailability clean.
 * @returns {number} count of rows removed
 */
function prunePastAvailability() {
  var sheet = getBookingAvailabilitySheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;

  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var cutoff = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  var rowsToDelete = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dateCell = row[0];
    var timeCell = row[1];
    if (!(dateCell instanceof Date)) continue;
    var dateStr = Utilities.formatDate(dateCell, tz, 'yyyy-MM-dd');
    var timeStr = '';
    if (timeCell instanceof Date) {
      timeStr = Utilities.formatDate(timeCell, tz, 'HH:mm');
    } else {
      timeStr = String(timeCell || '').trim().substring(0, 5);
    }
    if (!timeStr) continue;
    var dateTime = new Date(dateStr + 'T' + timeStr + ':00');
    if (isNaN(dateTime.getTime())) continue;
    if (dateTime < cutoff) {
      rowsToDelete.push(i + 1); // sheet is 1-indexed and has header row
    }
  }

  for (var d = rowsToDelete.length - 1; d >= 0; d--) {
    sheet.deleteRow(rowsToDelete[d]);
  }
  Logger.log('Pruned ' + rowsToDelete.length + ' past availability rows');
  return rowsToDelete.length;
}

/**
 * Hourly maintenance: prune past availability and refresh future availability.
 * Set an Apps Script time-based trigger to call this hourly.
 */
function hourlyAvailabilityMaintenance() {
  prunePastAvailability();
  refreshBookingAvailabilityCache();
}

/**
 * Check availability for a time slot (teachers vs lessons)
 * @param {string} dateStr - Date in format 'YYYY-MM-DD'
 * @param {string} timeStr - Time in format 'HH:mm'
 * @param {Object} existingLessonsMap - Pre-loaded map of existing lessons by date and time (optional)
 * @returns {Object} Availability information {available: boolean, teacherCount: number, lessonCount: number, availableSlots: number, teachers: Array}
 */
function checkTimeSlotAvailability(dateStr, timeStr, existingLessonsMap) {
  try {
    // Get available teachers for this time slot
    var dateTime = new Date(dateStr + 'T' + timeStr + ':00');
    if (isNaN(dateTime.getTime())) {
      return {
        available: false,
        teacherCount: 0,
        lessonCount: 0,
        availableSlots: 0,
        teachers: []
      };
    }
    
    var availableTeachers = getAvailableTeachersForTime(dateTime, 50); // 50 minute lessons
    var teacherCount = availableTeachers.length;
    
    // Get existing lessons count from the pre-loaded map instead of reading sheet
    var lessonCount = 0;
    if (existingLessonsMap && existingLessonsMap[dateStr] && existingLessonsMap[dateStr][timeStr]) {
      var lessons = existingLessonsMap[dateStr][timeStr];
      if (Array.isArray(lessons)) {
        // Only count scheduled lessons (not reserved, cancelled, etc.)
        lessonCount = lessons.filter(function(lesson) {
          return lesson.status === 'scheduled';
        }).length;
      }
    } else if (!existingLessonsMap) {
      // Fallback: read sheet if map not provided (for backward compatibility)
      var ss = SpreadsheetApp.openById(SS_ID);
      var scheduleSheet = ss.getSheetByName('MonthlySchedule');
      
      if (scheduleSheet) {
        var data = scheduleSheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0];
          var startIdx = headers.indexOf('Start');
          var statusIdx = headers.indexOf('Status');
          
          if (startIdx !== -1 && statusIdx !== -1) {
            var tz = Session.getScriptTimeZone();
            for (var i = 1; i < data.length; i++) {
              var row = data[i];
              var startTime = row[startIdx];
              
              if (startTime instanceof Date) {
                var rowDateStr = Utilities.formatDate(startTime, tz, 'yyyy-MM-dd');
                var rowTimeStr = Utilities.formatDate(startTime, tz, 'HH:mm');
                
                // Only count scheduled lessons (not reserved, cancelled, etc.)
                var status = row[statusIdx] || 'scheduled';
                if (rowDateStr === dateStr && rowTimeStr === timeStr && status === 'scheduled') {
                  lessonCount++;
                }
              }
            }
          }
        }
      }
    }
    
    // Calculate available slots: teachers - lessons
    var availableSlots = Math.max(0, teacherCount - lessonCount);
    var isAvailable = availableSlots > 0;
    
    return {
      available: isAvailable,
      teacherCount: teacherCount,
      lessonCount: lessonCount,
      availableSlots: availableSlots,
      teachers: availableTeachers
    };
    
  } catch (error) {
    Logger.log('Error checking availability: ' + error.toString());
    return {
      available: false,
      teacherCount: 0,
      lessonCount: 0,
      availableSlots: 0,
      teachers: []
    };
  }
}

/**
 * Get list of all unique teacher names from TeacherSchedules sheet
 * @returns {Array} Array of unique teacher names
 */
function getTeacherNames() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var cacheSheet = ss.getSheetByName('TeacherSchedules');
    
    if (!cacheSheet) {
      Logger.log('TeacherSchedules sheet not found');
      return [];
    }
    
    var data = cacheSheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }
    
    var headers = data[0];
    var teacherNameIdx = headers.indexOf('TeacherName');
    
    if (teacherNameIdx === -1) {
      Logger.log('TeacherName column not found in TeacherSchedules');
      return [];
    }
    
    // Get unique teacher names
    var teacherSet = new Set();
    for (var i = 1; i < data.length; i++) {
      var teacherName = String(data[i][teacherNameIdx] || '').trim();
      if (teacherName) {
        teacherSet.add(teacherName);
      }
    }
    
    var teachers = Array.from(teacherSet).sort();
    
    // Add "Sham" to the list if not already present (Sham has a separate calendar)
    if (teachers.indexOf('Sham') === -1) {
      teachers.push('Sham');
      teachers.sort();
    }
    
    Logger.log('Found ' + teachers.length + ' unique teachers');
    return teachers;
    
  } catch (error) {
    Logger.log('Error in getTeacherNames: ' + error.toString());
    // Return at least Sham if error occurs
    return ['Sham'];
  }
}

/**
 * Check if a specific teacher is available at a given time
 * @param {string} teacherName - Name of the teacher (e.g., "Sham")
 * @param {Date} startTime - Start time of the lesson
 * @param {Date} endTime - End time of the lesson
 * @param {boolean} checkShamCalendarOnly - If true, only check Sham's calendar (for Sham-only lessons). If false, check both calendars (for regular lessons with Sham)
 * @returns {boolean} True if teacher is available, false otherwise
 */
function checkTeacherAvailability(teacherName, startTime, endTime, checkShamCalendarOnly) {
  try {
    if (!teacherName || teacherName.trim().toLowerCase() !== 'sham') {
      // For other teachers, check TeacherSchedules sheet
      var dateStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var schedules = getCachedTeacherSchedule(dateStr);
      var teacherScheduled = schedules.some(function(schedule) {
        if (schedule.teacherName.toLowerCase() !== teacherName.toLowerCase()) {
          return false;
        }
        
        var timeStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
        var endTimeStr = Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm');
        
        var normalizedStartTime = String(schedule.startTime || '').trim().substring(0, 5);
        var normalizedEndTime = String(schedule.endTime || '').trim().substring(0, 5);
        var normalizedTimeStr = String(timeStr || '').trim().substring(0, 5);
        var normalizedEndTimeStr = String(endTimeStr || '').trim().substring(0, 5);
        
        return normalizedTimeStr >= normalizedStartTime && normalizedEndTimeStr <= normalizedEndTime;
      });
      
      return teacherScheduled;
    }
    
    // For Sham, check TeacherSchedules first
    var dateStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var schedules = getCachedTeacherSchedule(dateStr);
    var shamScheduled = schedules.some(function(schedule) {
      if (schedule.teacherName.toLowerCase() !== 'sham') {
        return false;
      }
      
      var timeStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
      var endTimeStr = Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm');
      
      var normalizedStartTime = String(schedule.startTime || '').trim().substring(0, 5);
      var normalizedEndTime = String(schedule.endTime || '').trim().substring(0, 5);
      var normalizedTimeStr = String(timeStr || '').trim().substring(0, 5);
      var normalizedEndTimeStr = String(endTimeStr || '').trim().substring(0, 5);
      
      return normalizedTimeStr >= normalizedStartTime && normalizedEndTimeStr <= normalizedEndTime;
    });
    
    if (!shamScheduled) {
      Logger.log('Sham is not scheduled to work at this time');
      return false;
    }
    
    // Check Sham's calendar for conflicts - if Sham has any lesson, he's not available
    var shamCalendar = CalendarApp.getCalendarById(OWNERS_COURSE_CAL_ID);
    if (shamCalendar) {
      // Check for existing events in Sham's calendar during the requested time
      var events = shamCalendar.getEvents(startTime, endTime);
      
      // Filter out events that are cancelled or rescheduled
      var conflictingEvents = events.filter(function(event) {
        var title = event.getTitle() || '';
        // Ignore cancelled or rescheduled events
        if (/\[CANCELLED\]/i.test(title) || /\[RESCHEDULED\]/i.test(title)) {
          return false;
        }
        return true;
      });
      
      if (conflictingEvents.length > 0) {
        Logger.log('Sham has ' + conflictingEvents.length + ' conflicting event(s) in Sham calendar at this time');
        return false; // Sham is not available - he already has a lesson
      }
    }
    
    // Also check regular lesson calendar for conflicts - if Sham has a lesson there, he's not available
    var regularCalendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    if (regularCalendar) {
      var regularEvents = regularCalendar.getEvents(startTime, endTime);
      // Filter for events with Sham as teacher (check description)
      var shamConflicts = regularEvents.filter(function(event) {
        var title = event.getTitle() || '';
        var description = event.getDescription() || '';
        // Ignore cancelled or rescheduled events
        if (/\[CANCELLED\]/i.test(title) || /\[RESCHEDULED\]/i.test(title)) {
          return false;
        }
        // Check if this event is assigned to Sham
        return /Teacher:\s*Sham/i.test(description) || /Teacher:\s*sham/i.test(description);
      });
      
      if (shamConflicts.length > 0) {
        Logger.log('Sham has ' + shamConflicts.length + ' conflicting regular lesson(s) at this time');
        return false; // Sham is not available - he already has a lesson
      }
    }
    
    return true;
    
  } catch (error) {
    Logger.log('Error checking teacher availability: ' + error.toString());
    return false;
  }
}

/**
 * Get available time slots for a week, filtered by teacher availability and existing lessons
 * @param {string} weekStartISO - ISO string of Monday of the week (e.g., "2024-01-15T00:00:00.000Z")
 * @param {string} studentId - Student ID (optional - only used for logging/context, not for filtering)
 * @param {Array} teacherFilter - Array of teacher names (optional - if provided, only show slots where these teachers are available)
 * @returns {string} JSON string of available slots by date and time
 */
/**
 * Get available slots for a week (uses cache for performance)
 * @param {string} weekStartISO - ISO string of Monday of the week
 * @param {string} studentId - Student ID (optional)
 * @param {Array} teacherFilter - Array of teacher names to filter by (optional)
 * @returns {string} JSON string of available slots
 */
function getAvailableSlotsForWeek(weekStartISO, studentId, teacherFilter) {
  // Use cached version for better performance
  return getAvailableSlotsForWeekFromCache(weekStartISO, studentId, teacherFilter);
}

/**
 * OLD getAvailableSlotsForWeek function (kept as fallback)
 * @deprecated Use getAvailableSlotsForWeekFromCache instead
 */
function getAvailableSlotsForWeekOld(weekStartISO, studentId, teacherFilter) {
  try {
    Logger.log('=== getAvailableSlotsForWeekOld called ===');
    Logger.log('Week start: ' + weekStartISO);
    Logger.log('Student ID: ' + (studentId || 'not provided'));
    Logger.log('Teacher filter: ' + (teacherFilter ? JSON.stringify(teacherFilter) : 'none'));
    
    // Parse week start date
    var weekStart = new Date(weekStartISO);
    if (isNaN(weekStart.getTime())) {
      Logger.log('Invalid weekStartISO: ' + weekStartISO);
      return JSON.stringify({ error: 'Invalid week start date' });
    }
    
    // Calculate week end (7 days from start)
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    // Validate and normalize teacher filter
    var normalizedTeacherFilter = null;
    if (teacherFilter && Array.isArray(teacherFilter) && teacherFilter.length > 0) {
      normalizedTeacherFilter = teacherFilter.map(function(name) {
        return String(name).trim();
      }).filter(function(name) {
        return name.length > 0;
      });
      
      if (normalizedTeacherFilter.length === 0) {
        normalizedTeacherFilter = null; // Empty array = no filter
      } else {
        Logger.log('Normalized teacher filter: ' + JSON.stringify(normalizedTeacherFilter));
      }
    }
    
    // Get student name for logging (optional)
    var studentName = null;
    if (studentId) {
      try {
        var students = getStudents();
        var headers = students[0];
        var idIdx = headers.indexOf('Student ID');
        var nameIdx = headers.indexOf('Name');
        
        if (idIdx !== -1 && nameIdx !== -1) {
          for (var i = 1; i < students.length; i++) {
            if (String(students[i][idIdx]) === String(studentId)) {
              studentName = String(students[i][nameIdx]).trim();
              break;
            }
          }
        }
        if (studentName) {
          Logger.log('Student name: ' + studentName);
        }
      } catch (e) {
        Logger.log('Could not get student name: ' + e.toString());
      }
    }
    
    // Initialize result structure
    var availableSlots = {};
    var timeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    var tz = Session.getScriptTimeZone();
    
    // Log the dates being checked
    var weekDates = [];
    for (var d = 0; d < 7; d++) {
      var dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + d);
      var dateStr = Utilities.formatDate(dayDate, tz, 'yyyy-MM-dd');
      weekDates.push(dateStr);
    }
    Logger.log('Checking availability for week dates: ' + JSON.stringify(weekDates));
    
    // READ MONTHLYSCHEDULE SHEET ONCE at the start
    var existingLessonsMap = {};
    try {
      var ss = SpreadsheetApp.openById(SS_ID);
      var scheduleSheet = ss.getSheetByName('MonthlySchedule');
      if (scheduleSheet) {
        var data = scheduleSheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0];
          var startIdx = headers.indexOf('Start');
          var statusIdx = headers.indexOf('Status');
          var isKidsLessonIdx = headers.indexOf('IsKidsLesson');
          
          if (startIdx !== -1 && statusIdx !== -1) {
            var tz = Session.getScriptTimeZone();
            for (var i = 1; i < data.length; i++) {
              var row = data[i];
              var startTime = row[startIdx];
              
              if (startTime instanceof Date) {
                var rowDateStr = Utilities.formatDate(startTime, tz, 'yyyy-MM-dd');
                var rowTimeStr = Utilities.formatDate(startTime, tz, 'HH:mm');
                var status = row[statusIdx] || 'scheduled';
                var isKidsLesson = row[isKidsLessonIdx] === '子' || row[isKidsLessonIdx] === true;
                
                // Only process lessons within the week range
                var lessonDate = new Date(startTime);
                if (lessonDate >= weekStart && lessonDate < weekEnd) {
                  if (!existingLessonsMap[rowDateStr]) {
                    existingLessonsMap[rowDateStr] = {};
                  }
                  if (!existingLessonsMap[rowDateStr][rowTimeStr]) {
                    existingLessonsMap[rowDateStr][rowTimeStr] = [];
                  }
                  existingLessonsMap[rowDateStr][rowTimeStr].push({
                    status: status,
                    isKidsLesson: isKidsLesson
                  });
                }
              }
            }
          }
        }
      }
      Logger.log('Loaded existing lessons map with ' + Object.keys(existingLessonsMap).length + ' days');
    } catch (e) {
      Logger.log('Error loading existing lessons: ' + e.toString());
      existingLessonsMap = {};
    }
    
    // Loop through each day (Monday to Sunday)
    for (var day = 0; day < 7; day++) {
      var dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + day);
      var dateStr = Utilities.formatDate(dayDate, tz, 'yyyy-MM-dd');
      
      availableSlots[dateStr] = {};
      
      // Check each time slot - PASS existingLessonsMap to avoid reading sheet
      for (var t = 0; t < timeSlots.length; t++) {
        var timeStr = timeSlots[t];
        
        // Get availability for this time slot - pass the pre-loaded lessons map
        var availability = checkTimeSlotAvailability(dateStr, timeStr, existingLessonsMap);
        
        // Log warning if no teachers found for any slot (indicates date mismatch)
        if (availability.teacherCount === 0 && day === 0 && t === 0) {
          Logger.log('⚠️ WARNING: No teachers found for ' + dateStr + ' ' + timeStr);
          Logger.log('   This likely means the TeacherSchedules sheet has data for different dates.');
          Logger.log('   Check if sheet has data for: ' + JSON.stringify(weekDates));
        }
        
        // Apply teacher filter if provided
        var filteredTeachers = availability.teachers || [];
        var filteredTeacherCount = availability.teacherCount || 0;
        
        if (normalizedTeacherFilter && normalizedTeacherFilter.length > 0) {
          // Filter teachers to only include selected ones
          filteredTeachers = availability.teachers.filter(function(teacher) {
            return normalizedTeacherFilter.indexOf(teacher) !== -1;
          });
          filteredTeacherCount = filteredTeachers.length;
        }
        
        // Calculate available slots based on filtered teachers
        var availableSlotsCount = Math.max(0, filteredTeacherCount - availability.lessonCount);
        var isAvailable = availableSlotsCount > 0;
        
        // Determine reason if unavailable
        var reason = null;
        if (!isAvailable) {
          if (filteredTeacherCount === 0) {
            if (normalizedTeacherFilter && normalizedTeacherFilter.length > 0) {
              reason = 'Selected teachers not available';
            } else {
              reason = 'No teachers available';
            }
          } else {
            reason = 'No available slots';
          }
        }
        
        // Store availability data
        availableSlots[dateStr][timeStr] = {
          available: isAvailable,
          teacherCount: filteredTeacherCount,
          lessonCount: availability.lessonCount,
          availableSlots: availableSlotsCount,
          teachers: filteredTeachers,
          reason: reason
        };
      }
    }
    
    Logger.log('Returning available slots for ' + Object.keys(availableSlots).length + ' days');
    return JSON.stringify(availableSlots);
    
  } catch (error) {
    Logger.log('Error in getAvailableSlotsForWeek: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    return JSON.stringify({ error: error.toString() });
  }
}

/**
 * Get week availability with kids/adults filtering
 * This is a wrapper around getAvailableSlotsForWeek that adds kids/adults separation logic
 * @param {string} weekStartISO - ISO string of Monday of the week
 * @param {string} studentId - Student ID (optional - used to determine if student is a child)
 * @returns {string} JSON string of available slots by date and time (filtered for kids/adults)
 */
function getWeekAvailability(weekStartISO, studentId) {
  try {
    Logger.log('=== getWeekAvailability called ===');
    Logger.log('Week start: ' + weekStartISO);
    Logger.log('Student ID: ' + (studentId || 'not provided'));
    
    // Get base availability (without kids/adults filtering)
    var baseAvailability = getAvailableSlotsForWeek(weekStartISO, studentId, null);
    var availabilityData = JSON.parse(baseAvailability);
    
    // If studentId is provided, check if student is a child
    var isChildStudent = false;
    if (studentId) {
      try {
        var student = getStudentById(studentId);
        if (student) {
          isChildStudent = !!(student['子'] === '子' || student.child === true || student.child === '子');
          Logger.log('Student is child: ' + isChildStudent);
        }
      } catch (e) {
        Logger.log('Could not determine student type: ' + e.toString());
      }
    }
    
    // If student is a child, filter out slots with adult lessons
    if (isChildStudent) {
      Logger.log('Filtering availability for child student - removing slots with adult lessons');
      
      // Get existing lessons for the week to check for adult lessons
      var weekStart = new Date(weekStartISO);
      var existingLessons = getExistingLessonsFromSheet(weekStart);
      var existingLessonsObj = {};
      
      // Parse existing lessons if it's a JSON string
      if (typeof existingLessons === 'string') {
        try {
          existingLessonsObj = JSON.parse(existingLessons);
        } catch (e) {
          Logger.log('Could not parse existing lessons: ' + e.toString());
          existingLessonsObj = {};
        }
      } else {
        existingLessonsObj = existingLessons || {};
      }
      
      // Filter availability data
      for (var dateStr in availabilityData) {
        for (var timeStr in availabilityData[dateStr]) {
          var slot = availabilityData[dateStr][timeStr];
          
          // Check if this slot has existing lessons
          if (existingLessonsObj[dateStr] && existingLessonsObj[dateStr][timeStr]) {
            var lessons = existingLessonsObj[dateStr][timeStr];
            var hasAdultLesson = false;
            
            // Check if any lesson in this slot is an adult lesson
            if (Array.isArray(lessons)) {
              for (var i = 0; i < lessons.length; i++) {
                var lesson = lessons[i];
                var isKidsLesson = lesson.isKidsLesson === true || lesson.isKidsLesson === '子';
                
                // If lesson exists and is NOT a kids lesson, it's an adult lesson
                if (!isKidsLesson) {
                  hasAdultLesson = true;
                  Logger.log('Found adult lesson in slot ' + dateStr + ' ' + timeStr + ': ' + (lesson.studentName || lesson.title));
                  break;
                }
              }
            }
            
            // If slot has adult lessons, mark as unavailable for kids
            if (hasAdultLesson) {
              slot.available = false;
              slot.availableSlots = 0;
              slot.reason = 'Slot contains adult lessons - kids cannot be booked here';
              Logger.log('Blocked slot ' + dateStr + ' ' + timeStr + ' for child student (has adult lessons)');
            }
          }
        }
      }
    }
    
    Logger.log('Returning filtered availability data');
    return JSON.stringify(availabilityData);
    
  } catch (error) {
    Logger.log('Error in getWeekAvailability: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    return JSON.stringify({ error: error.toString() });
  }
}

function getDashboardCardData() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var statsSheet = ss.getSheetByName('Stats');
  var stats = statsSheet ? statsSheet.getDataRange().getValues() : [];
  var now = new Date();
  var thisMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  var lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var lastMonth = Utilities.formatDate(lastMonthDate, Session.getScriptTimeZone(), 'yyyy-MM');
  var lessonsThisMonth = 0;
  var studentsThisMonth = 0;
  var lessonsLastMonth = 0;
  for (var i = 1; i < stats.length; i++) {
    var monthCell = stats[i][0];
    var monthStr = toYYYYMM(monthCell);
    if (monthStr === thisMonth) {
      lessonsThisMonth = Number(stats[i][1]) || 0;
      studentsThisMonth = Number(stats[i][2]) || 0;
    }
    if (monthStr === lastMonth) {
      lessonsLastMonth = Number(stats[i][1]) || 0;
    }
  }
  var diff = lessonsThisMonth - lessonsLastMonth;
  var diffText = (diff >= 0 ? '+' : '') + diff + ' this month';

  // Fees: sum all 'Total' in Payment sheet
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var paymentData = paymentSheet ? paymentSheet.getDataRange().getValues() : [];
  var paymentHeaders = paymentData[0] || [];
  var totalIdx = paymentHeaders.indexOf('Total');
  var feesThisMonth = 0;
  for (var i = 1; i < paymentData.length; i++) {
    var row = paymentData[i];
    var rowTotal = row[totalIdx];
    if (rowTotal && !isNaN(rowTotal)) {
      feesThisMonth += Number(rowTotal);
    }
  }
  return {
    lessonsThisMonth: lessonsThisMonth,
    studentsThisMonth: studentsThisMonth,
    diffText: diffText,
    feesThisMonth: feesThisMonth
  };
}

function updateData() {
  var now = new Date();
  var monthStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  
  // Use the new dual-month function to cache both current and next month
  var results = cacheMonthlyEventsForBothMonths();
  
  // Still tally stats for current month
  tallyLessonsForMonthAndStore(monthStr);
  
  return results;
}

function getTotalFeeFromStudentData(studentID, lessons) {
  return getTotalFeeForStudent(studentID, lessons);
}

function getAvailableMonths(studentID, yearStr) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(LESSON_SHEET);
  var data = sh.getDataRange().getDisplayValues();
  var headers = data.shift();
  var idIdx = headers.indexOf('Student ID');
  var monthIdx = headers.indexOf('Month');
  
  var months = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(studentID)) {
      var monthCell = data[i][monthIdx];
      if (monthCell) {
        var monthNameOnly = monthNameFromAny(monthCell);
        months.push(monthNameOnly);
      }
    }
  }
  return months;
}

function getStudentDetailsOptimized(studentId) {
  return getStudentDetails(studentId);
}

function showForm() {
  // Placeholder for add student form functionality
  console.log('Add student form should be shown');
  // TODO: Implement add student form modal
}

function toggleNotifications() {
  // Placeholder for notifications toggle functionality
  console.log('Notifications should be toggled');
  // TODO: Implement notifications panel
}

function fetchNotifications() {
  // Placeholder for fetching notifications
  console.log('Notifications should be fetched');
  // TODO: Implement notifications fetching
}

function getFeatureFlags() {
  // Return feature flags configuration to frontend
  return FEATURE_FLAGS;
}

/**
 * Get current user (for tooltip system)
 * @returns {string} Current staff name from Code sheet
 */
function getCurrentUser() {
  return getCurrentStaffName();
}

/**
 * Get total number of lessons for a student in a given month
 * @param {string} studentId - Student ID
 * @param {string} monthText - Month in format "Month Year" (e.g., "January 2024")
 * @returns {number} Total number of lessons, or 0 if not found
 */
function getStudentLessonTotal(studentId, monthText) {
  try {
    Logger.log('=== getStudentLessonTotal called ===');
    Logger.log('Student ID: ' + studentId);
    Logger.log('Month: ' + monthText);
    
    // Get student name from ID
    var students = getStudents();
    var headers = students[0];
    var idIdx = headers.indexOf('Student ID');
    var nameIdx = headers.indexOf('Name');
    var studentName = null;
    
    for (var i = 1; i < students.length; i++) {
      if (String(students[i][idIdx]) === String(studentId)) {
        studentName = String(students[i][nameIdx]).trim();
        break;
      }
    }
    
    if (!studentName) {
      Logger.log('Student not found for ID: ' + studentId);
      return 0;
    }
    
    // Get payment info for the month
    var paymentInfo = getPaymentInfoForMonth(studentName, monthText);
    
    if (paymentInfo && paymentInfo.lessons) {
      Logger.log('Total lessons for ' + studentName + ' in ' + monthText + ': ' + paymentInfo.lessons);
      return paymentInfo.lessons;
    }
    
    Logger.log('No payment info found for ' + studentName + ' in ' + monthText);
    return 0;
    
  } catch (error) {
    Logger.log('Error in getStudentLessonTotal: ' + error.toString());
    return 0;
  }
}

/**
 * Diagnostic function to check TeacherSchedules sheet structure and data
 * @returns {Object} Diagnostic information about TeacherSchedules sheet
 */
function diagnoseTeacherSchedules() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var cacheSheet = ss.getSheetByName('TeacherSchedules');
    
    var result = {
      sheetExists: false,
      rowCount: 0,
      headers: [],
      sampleRows: [],
      columnIndices: {},
      issues: []
    };
    
    if (!cacheSheet) {
      result.issues.push('TeacherSchedules sheet does not exist');
      return JSON.stringify(result);
    }
    
    result.sheetExists = true;
    
    var data = cacheSheet.getDataRange().getValues();
    result.rowCount = data.length;
    
    if (data.length < 2) {
      result.issues.push('Sheet is empty (no data rows, only header)');
      return JSON.stringify(result);
    }
    
    // Get headers
    result.headers = data[0];
    
    // Find column indices
    var dateIdx = result.headers.indexOf('Date');
    var teacherNameIdx = result.headers.indexOf('TeacherName');
    var startTimeIdx = result.headers.indexOf('StartTime');
    var endTimeIdx = result.headers.indexOf('EndTime');
    
    result.columnIndices = {
      Date: dateIdx,
      TeacherName: teacherNameIdx,
      StartTime: startTimeIdx,
      EndTime: endTimeIdx
    };
    
    // Check for missing columns
    if (dateIdx === -1) result.issues.push('Date column not found');
    if (teacherNameIdx === -1) result.issues.push('TeacherName column not found');
    if (startTimeIdx === -1) result.issues.push('StartTime column not found');
    if (endTimeIdx === -1) result.issues.push('EndTime column not found');
    
    if (result.issues.length > 0) {
      return JSON.stringify(result);
    }
    
    // Get sample rows (first 5 data rows)
    var sampleCount = Math.min(5, data.length - 1);
    for (var i = 1; i <= sampleCount; i++) {
      var row = data[i];
      var dateCell = row[dateIdx];
      var dateStr = '';
      
      if (dateCell instanceof Date) {
        dateStr = Utilities.formatDate(dateCell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        dateStr = String(dateCell || '').trim();
      }
      
      result.sampleRows.push({
        rowNumber: i + 1,
        date: dateCell,
        dateFormatted: dateStr,
        dateType: typeof dateCell,
        teacherName: String(row[teacherNameIdx] || '').trim(),
        startTime: String(row[startTimeIdx] || '').trim(),
        endTime: String(row[endTimeIdx] || '').trim()
      });
    }
    
    // Check current week dates
    var today = new Date();
    var dayOfWeek = today.getDay();
    var daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    var weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    var tz = Session.getScriptTimeZone();
    var weekDates = [];
    for (var d = 0; d < 7; d++) {
      var dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + d);
      var dateStr = Utilities.formatDate(dayDate, tz, 'yyyy-MM-dd');
      weekDates.push(dateStr);
    }
    
    // Check if any rows match current week dates
    var matchingRows = 0;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var dateCell = row[dateIdx];
      var rowDateStr = '';
      
      if (dateCell instanceof Date) {
        rowDateStr = Utilities.formatDate(dateCell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        rowDateStr = String(dateCell || '').trim();
      }
      
      if (weekDates.indexOf(rowDateStr) !== -1) {
        matchingRows++;
      }
    }
    
    result.matchingRowsForCurrentWeek = matchingRows;
    result.weekDates = weekDates;
    
    return JSON.stringify(result);
    
  } catch (error) {
    return JSON.stringify({
      error: error.toString(),
      sheetExists: false,
      rowCount: 0,
      headers: [],
      sampleRows: [],
      columnIndices: {},
      issues: ['Error occurred: ' + error.toString()]
    });
  }
}

function getLatestRecordData(studentName, studentIdOpt) {
  // Get latest record data for the Latest Record component
  Logger.log('=== getLatestRecordData called ===');
  Logger.log('Student name: ' + studentName + ', studentId: ' + (studentIdOpt || ''));
  
  var now = new Date();
  var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMMM yyyy');
  var nextMonth = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 1), Session.getScriptTimeZone(), 'MMMM yyyy');
  
  Logger.log('Current month: ' + currentMonth);
  Logger.log('Next month: ' + nextMonth);
  
  // Convert to 3-letter month format for component
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  
  var currentMonthShort = shortMonthNames[now.getMonth()];
  var nextMonthShort = shortMonthNames[(now.getMonth() + 1) % 12];
  
  // Ensure cache exists and is populated for both months
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) {
    Logger.log('MonthlySchedule sheet not found, creating cache for current month...');
    cacheMonthlyEvents(currentMonth);
  } else {
    // Check if cache needs to be refreshed (if sheet is empty or has no data for current month)
    var data = cacheSheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('MonthlySchedule sheet is empty, populating cache for current month...');
      cacheMonthlyEvents(currentMonth);
    }
  }
  
  // Get events for both months
  var currentMonthEvents = getStudentEventsForMonth(studentName, currentMonth);
  var nextMonthEvents = getStudentEventsForMonth(studentName, nextMonth);
  
  Logger.log('Current month events: ' + currentMonthEvents.length);
  Logger.log('Next month events: ' + nextMonthEvents.length);
  
  // Resolve student ID (for Lessons + Payment lookup)
  var studentId = studentIdOpt || null;
  if (!studentId) {
    try {
      var studentsSheet = ss.getSheetByName('Students');
      var studentsData = studentsSheet ? studentsSheet.getDataRange().getValues() : [];
      if (studentsData.length > 1) {
        var sHeaders = studentsData[0];
        var idxId = sHeaders.indexOf('ID');
        var idxName = sHeaders.indexOf('Name');
        for (var si = 1; si < studentsData.length; si++) {
          var nm = String(studentsData[si][idxName] || '').trim();
          if (nm === studentName) {
            studentId = String(studentsData[si][idxId] || '').trim();
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('Error mapping student name to ID in getLatestRecordData: ' + e);
    }
  }

  // Get payment information for both months
  var currentMonthPaymentInfo = getPaymentInfoForMonth(studentName, currentMonth, studentId);
  var nextMonthPaymentInfo = getPaymentInfoForMonth(studentName, nextMonth, studentId);
  
  Logger.log('Current month payment info: ' + JSON.stringify(currentMonthPaymentInfo));
  Logger.log('Next month payment info: ' + JSON.stringify(nextMonthPaymentInfo));
  
  // Debug: Log what we found
  Logger.log('=== DEBUG SUMMARY ===');
  Logger.log('Current month: ' + currentMonth + ' (Short: ' + currentMonthShort + ')');
  Logger.log('Next month: ' + nextMonth + ' (Short: ' + nextMonthShort + ')');
  Logger.log('Current month events found: ' + currentMonthEvents.length);
  Logger.log('Next month events found: ' + nextMonthEvents.length);
  Logger.log('Current month payment found: ' + (currentMonthPaymentInfo !== null));
  Logger.log('Next month payment found: ' + (nextMonthPaymentInfo !== null));
  
  var latestByMonth = {};

  // Helper to get planned lessons from Lessons sheet
  function getPlannedLessonsForMonth(studentId, yearNum, monthNum) {
    try {
      var lessonsSheet = ss.getSheetByName('Lessons');
      if (!lessonsSheet || !studentId) return 0;
      var lessonsData = lessonsSheet.getDataRange().getDisplayValues();
      if (lessonsData.length < 2) return 0;
      var lh = lessonsData[0];
      var idxId = lh.indexOf('Student ID');
      var idxMonth = lh.indexOf('Month');
      var idxLessons = lh.indexOf('Lessons');
      if (idxId === -1 || idxMonth === -1 || idxLessons === -1) return 0;
      var targetKey = yearNum + '-' + ('0' + monthNum).slice(-2);
      for (var i = 1; i < lessonsData.length; i++) {
        var row = lessonsData[i];
        if (String(row[idxId]).trim() !== String(studentId)) continue;
        var mVal = String(row[idxMonth] || '').trim();
        if (mVal === targetKey) {
          var planned = parseInt(row[idxLessons]) || 0;
          return planned;
        }
      }
      return 0;
    } catch (e) {
      Logger.log('Error reading Lessons sheet planned count: ' + e);
      return 0;
    }
  }
  
  // Helper to build month data with planned vs scheduled
  function buildMonthData(monthLabel, monthShort, eventsArr, paymentInfo, yearNum, monthNum) {
    var plannedFromPayment = paymentInfo ? (paymentInfo.lessons || 0) : 0;
    var plannedFromLessons = (studentId ? getPlannedLessonsForMonth(studentId, yearNum, monthNum) : 0);
    var planned = plannedFromPayment > 0 ? plannedFromPayment : plannedFromLessons;
    var paymentStatus = paymentInfo ? paymentInfo.status : '未';

    var scheduledCount = eventsArr.length;
    var data = {
      Payment: paymentStatus,
      lessons: eventsArr.slice() // copy existing events
    };

    var unscheduledCount = Math.max(0, planned - scheduledCount);
    if (unscheduledCount > 0) {
      Logger.log('Adding ' + unscheduledCount + ' unscheduled lessons for ' + studentName + ' in ' + monthLabel + ' (planned=' + planned + ', scheduled=' + scheduledCount + ')');
      for (var i = 0; i < unscheduledCount; i++) {
        data.lessons.push({ day: '--', time: '--', status: 'unscheduled' });
      }
    }

    // If nothing planned/scheduled and no payment, still include empty to avoid disappearance? Only include if events or planned or payment info exists.
    if (data.lessons.length > 0 || paymentInfo !== null || planned > 0) {
      latestByMonth[monthShort] = data;
    }
  }

  // Add current month data (prefer payment lessons, fallback to Lessons sheet)
  buildMonthData(
    currentMonth,
    currentMonthShort,
    currentMonthEvents,
    currentMonthPaymentInfo,
    now.getFullYear(),
    now.getMonth() + 1
  );
  
  // Add next month data
  buildMonthData(
    nextMonth,
    nextMonthShort,
    nextMonthEvents,
    nextMonthPaymentInfo,
    (now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()),
    ((now.getMonth() + 1) % 12) + 1
  );
  
  // If no data for current/next month, try to get data from previous months
  if (Object.keys(latestByMonth).length === 0) {
    for (var i = 1; i <= 3; i++) {
      var prevMonth = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() - i, 1), Session.getScriptTimeZone(), 'MMMM yyyy');
      var prevMonthShort = shortMonthNames[(now.getMonth() - i + 12) % 12];
      var prevMonthEvents = getStudentEventsForMonth(studentName, prevMonth);
      var prevMonthPaymentInfo = getPaymentInfoForMonth(studentName, prevMonth);
      
      if (prevMonthEvents.length > 0 || prevMonthPaymentInfo !== null) {
        var prevMonthData = {
          Payment: prevMonthPaymentInfo ? prevMonthPaymentInfo.status : '未',
          lessons: prevMonthEvents
        };
        
        // Add unscheduled lessons if payment info exists and there are more paid lessons than scheduled
        if (prevMonthPaymentInfo && prevMonthPaymentInfo.lessons > prevMonthEvents.length) {
          var unscheduledCount = prevMonthPaymentInfo.lessons - prevMonthEvents.length;
          Logger.log('Adding ' + unscheduledCount + ' unscheduled lessons for ' + studentName + ' in ' + prevMonth);
          
          for (var j = 0; j < unscheduledCount; j++) {
            prevMonthData.lessons.push({
              day: '--',
              time: '--',
              status: 'unscheduled'
            });
          }
        }
        
        latestByMonth[prevMonthShort] = prevMonthData;
        break;
      }
    }
  }
  
  Logger.log('Final latestByMonth object: ' + JSON.stringify(latestByMonth));
  
  // Debug: log what we're sending back per month, including first lesson eventID
  try {
    Object.keys(latestByMonth || {}).forEach(function(monthKey) {
      var lessonsArr = latestByMonth[monthKey] && latestByMonth[monthKey].lessons ? latestByMonth[monthKey].lessons : [];
      var first = lessonsArr.length ? lessonsArr[0] : null;
      var firstSummary = first ? {
        day: first.day,
        time: first.time,
        status: first.status,
        eventID: first.eventID || first.eventId || 'MISSING'
      } : 'none';
      Logger.log('[LATEST OUT] month=%s lessons=%s firstLesson=%s', monthKey, lessonsArr.length, JSON.stringify(firstSummary));
    });
  } catch (e) {
    Logger.log('Error logging latestByMonth outbound: ' + e);
  }
  
  return {
    latestByMonth: latestByMonth
  };
}

function getPaymentInfoForMonth(studentName, monthText, studentIdOpt) {
  Logger.log('=== getPaymentInfoForMonth called ===');
  Logger.log('Student name: ' + studentName + ', studentId: ' + (studentIdOpt || ''));
  Logger.log('Month text: ' + monthText);
  
  var ss = SpreadsheetApp.openById(SS_ID);
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  if (!paymentSheet) {
    Logger.log('Payment sheet not found');
    return null;
  }

  var data = paymentSheet.getDataRange().getValues();
  var headers = data[0];
  Logger.log('Payment sheet headers: ' + JSON.stringify(headers));
  
  var studentIdIdx = headers.indexOf('Student ID');
  var monthIdx = headers.indexOf('Month');
  var yearIdx = headers.indexOf('Year');
  var lessonsIdx = headers.indexOf('Lessons'); // optional
  var amountIdx = headers.indexOf('Amount');   // optional
  var totalIdx = headers.indexOf('Total');     // optional
  
  if (studentIdIdx === -1 || monthIdx === -1 || yearIdx === -1) {
    Logger.log('Required columns not found in Payment sheet (need Student ID, Month, Year)');
    return null;
  }

  // Parse monthText to target year/month
  var targetYear = null;
  var targetMonthNum = null;
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    targetYear = parts[0];
    targetMonthNum = parseInt(parts[1], 10);
  } else {
    // Expect like 'May 2025'
    var tokens = String(monthText || '').trim().split(/\s+/);
    for (var t = 0; t < tokens.length; t++) {
      if (/^\d{4}$/.test(tokens[t])) {
        targetYear = tokens[t];
      }
    }
    targetMonthNum = monthNumberFromText(monthText);
  }

  if (!targetYear || !targetMonthNum) {
    Logger.log('Could not parse target month/year from: ' + monthText);
    return null;
  }

  // Map student name -> ID as fallback
  var studentId = studentIdOpt || null;
  if (!studentId) {
    try {
      var studentsSheet = ss.getSheetByName('Students');
      var studentsData = studentsSheet ? studentsSheet.getDataRange().getValues() : [];
      if (studentsData.length > 1) {
        var sHeaders = studentsData[0];
        var idxId = sHeaders.indexOf('ID');
        var idxName = sHeaders.indexOf('Name');
        for (var si = 1; si < studentsData.length; si++) {
          var nm = String(studentsData[si][idxName] || '').trim();
          if (nm === studentName) {
            studentId = String(studentsData[si][idxId] || '').trim();
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('Error mapping student name to ID: ' + e);
    }
  }

  if (!studentId) {
    Logger.log('No Student ID resolved; cannot match payments reliably.');
    return null;
  }

  Logger.log('Looking for payment logs: studentId=' + studentId + ', monthNum=' + targetMonthNum + ', year=' + targetYear);
  
  var totalLessons = 0;
  var totalAmount = 0;
  var foundAnyPayment = false;
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowStudentId = String(row[studentIdIdx] || '').trim();
    if (rowStudentId !== studentId) continue;

    var rowYear = String(row[yearIdx] || '').trim();
    var rowMonthRaw = String(row[monthIdx] || '').trim();
    var rowMonthNum = monthNumberFromText(rowMonthRaw);

    if (rowYear === targetYear && rowMonthNum === targetMonthNum) {
      foundAnyPayment = true;
      var lessons = lessonsIdx !== -1 ? (parseInt(row[lessonsIdx]) || 0) : 0;
      var amount = amountIdx !== -1 ? (parseFloat(row[amountIdx]) || 0) : 0;
      var total = totalIdx !== -1 ? (parseFloat(row[totalIdx]) || amount) : amount;
      
      totalLessons += lessons;
      totalAmount += total;
      
      Logger.log('Found payment log: lessons=' + lessons + ', total=' + total);
    }
  }
  
  if (foundAnyPayment) {
    Logger.log('Payment found for studentId ' + studentId + ' in ' + monthText + ': lessons=' + totalLessons + ', total=' + totalAmount);
    return {
      status: '済',
      lessons: totalLessons,
      amount: totalAmount,
      total: totalAmount
    };
  }
  
  Logger.log('No payment logs found for studentId ' + studentId + ' in ' + monthText);
  return null;
}

function getPaymentStatusForMonth(studentName, monthText, studentIdOpt) {
  var info = getPaymentInfoForMonth(studentName, monthText, studentIdOpt);
  return info ? info.status : null;
}



function testLatestRecordCommunication() {
  // Simple test function to verify communication
  Logger.log('=== testLatestRecordCommunication called ===');
  return {
    latestByMonth: {
      "Aug": {
        Payment: "済",
        lessons: [
          { day: "02", time: "15:00", status: "scheduled" }
        ]
      }
    }
  };
}

function getLatestRecordForStudent(studentName, studentIdOpt) {
  // API endpoint to get latest record data for the Latest Record component
  Logger.log('=== getLatestRecordForStudent called ===');
  Logger.log('Student name: ' + studentName + ', studentId: ' + (studentIdOpt || ''));
  
  try {
    var data = getLatestRecordData(studentName, studentIdOpt);
    Logger.log('getLatestRecordData returned: ' + JSON.stringify(data));
    
    // Ensure we're returning a proper object structure
    var result = {
      latestByMonth: data.latestByMonth || {}
    };
    
    Logger.log('Final result being returned: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('Error getting latest record data: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return { latestByMonth: {} };
  }
}

function deletePayment(payment) {
  Logger.log('🗑️ deletePayment called with: %s', JSON.stringify(payment));

  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName(PAYMENT_SHEET);
  if (!sh) throw new Error('Sheet "' + PAYMENT_SHEET + '" not found.');

  // Get headers and data (use getDisplayValues for consistency)
  var headerData = sh.getDataRange().getDisplayValues();
  var headers = headerData[0];
  var headersTrimmed = headers.map(function(h) { return String(h || '').trim(); });
  var data = sh.getDataRange().getDisplayValues();
  var txnIdIndex = headersTrimmed.indexOf('Transaction ID');
  
  if (txnIdIndex === -1) {
    Logger.log('⚠️ Warning: Transaction ID column not found in Payment sheet. Available headers: ' + JSON.stringify(headersTrimmed));
    throw new Error('Transaction ID column not found in payment sheet');
  }

  // Find the row with matching Transaction ID
  var rowToDelete = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][txnIdIndex]) === String(payment['Transaction ID'])) {
      rowToDelete = i + 1; // +1 because sheet rows are 1-indexed
      break;
    }
  }

  if (rowToDelete === -1) {
    throw new Error('Payment with Transaction ID ' + payment['Transaction ID'] + ' not found');
  }

  // Delete the row
  sh.deleteRow(rowToDelete);
  Logger.log('🗑️ Deleted payment row %s', rowToDelete);

  return true;
}

function testUnscheduledLessonsFeature(studentName, monthText) {
  // Test function to verify the unscheduled lessons feature
  Logger.log('=== Testing Unscheduled Lessons Feature ===');
  Logger.log('Student: ' + studentName);
  Logger.log('Month: ' + monthText);
  
  // Get payment info
  var paymentInfo = getPaymentInfoForMonth(studentName, monthText);
  Logger.log('Payment Info: ' + JSON.stringify(paymentInfo));
  
  // Get scheduled events
  var scheduledEvents = getStudentEventsForMonth(studentName, monthText);
  Logger.log('Scheduled Events: ' + scheduledEvents.length);
  
  // Calculate unscheduled lessons
  var unscheduledCount = 0;
  if (paymentInfo && paymentInfo.lessons > scheduledEvents.length) {
    unscheduledCount = paymentInfo.lessons - scheduledEvents.length;
  }
  
  Logger.log('Unscheduled Lessons: ' + unscheduledCount);
  
  // Create test data structure
  var testData = {
    Payment: paymentInfo ? paymentInfo.status : '未',
    lessons: scheduledEvents
  };
  
  // Add unscheduled lessons
  for (var i = 0; i < unscheduledCount; i++) {
    testData.lessons.push({
      day: '--',
      time: '--',
      status: 'unscheduled'
    });
  }
  
  Logger.log('Final Test Data: ' + JSON.stringify(testData));
  
  return {
    paymentInfo: paymentInfo,
    scheduledEvents: scheduledEvents,
    unscheduledCount: unscheduledCount,
    finalData: testData
  };
}

function clearCache() {
  // Clear the MonthlySchedule cache
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (cacheSheet) {
    ss.deleteSheet(cacheSheet);
    Logger.log('Cache cleared');
  }
}

function refreshCacheWithDemoStatus() {
  // Force refresh the cache to apply new demo status mapping
  Logger.log('=== Refreshing cache with new demo status mapping ===');
  
  // Clear existing cache
  clearCache();
  
  // Refresh current month cache
  var now = new Date();
  var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  var nextMonth = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 1), Session.getScriptTimeZone(), 'yyyy-MM');
  
  Logger.log('Refreshing cache for months: ' + currentMonth + ' and ' + nextMonth);
  
  // Cache both months with new status mapping
  var results = cacheMonthlyEventsForBothMonths();
  
  Logger.log('Cache refresh completed: ' + JSON.stringify(results));
  return results;
}

function getStudentEventsFromSheet(studentName, monthText) {
  // Get student events from sheet data for a specific month
  Logger.log('=== getStudentEventsFromSheet called ===');
  Logger.log('Student name: ' + studentName);
  Logger.log('Month text: ' + monthText);
  
  var ss = SpreadsheetApp.openById(SS_ID);
  var lessonsSheet = ss.getSheetByName('MonthlySchedule');
  if (!lessonsSheet) {
    Logger.log('MonthlySchedule sheet not found');
    return [];
  }
  
  var data = lessonsSheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('No data in MonthlySchedule sheet');
    return [];
  }
  
  var headers = data[0];
  var studentNameIdx = headers.indexOf('StudentName');
  var startIdx = headers.indexOf('Start');
  var statusIdx = headers.indexOf('Status');
  
  Logger.log('Column indices - StudentName: ' + studentNameIdx + ', Start: ' + startIdx + ', Status: ' + statusIdx);
  
  if (studentNameIdx === -1 || startIdx === -1 || statusIdx === -1) {
    Logger.log('Required columns not found');
    return [];
  }
  
  var studentEvents = [];
  
  // Parse month text to get month and year
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var year, monthName;
  
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    year = parts[0];
    monthName = monthNames[Number(parts[1]) - 1];
  } else if (/^[A-Za-z]+ \d{4}$/.test(monthText)) { // 'May 2025'
    var parts = monthText.trim().split(' ');
    monthName = parts[0];
    year = parts[1];
  } else {
    Logger.log('Invalid monthText format: ' + monthText);
    return [];
  }
  
  Logger.log('Looking for events in month: ' + monthName + ' year: ' + year);
  
  // Look for events for this student in the specified month
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowStudentName = String(row[studentNameIdx] || '').trim();
    var startTime = row[startIdx];
    var status = String(row[statusIdx] || 'scheduled');
    
    // Check if this event is for the target student
    if (rowStudentName === studentName) {
      // Check if the event is in the target month
      if (startTime instanceof Date) {
        var eventMonth = monthNames[startTime.getMonth()];
        var eventYear = startTime.getFullYear().toString();
        
        if (eventMonth === monthName && eventYear === year) {
          Logger.log('Found matching event in row ' + i + ' for ' + studentName + ' on ' + startTime);
          
          // Extract day and time
          var day = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'dd');
          var time = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
          
          studentEvents.push({
            day: day,
            time: time,
            status: status
          });
        }
      }
    }
  }
  
  Logger.log('Found ' + studentEvents.length + ' events for student ' + studentName + ' in ' + monthText);
  Logger.log('Events: ' + JSON.stringify(studentEvents));
  
  return studentEvents;
}

function debugStudentCreation() {
  Logger.log('=== Debug Student Creation ===');
  
  // First, let's see what headers we actually have
  var sh = SpreadsheetApp.openById(SS_ID).getSheetByName(STUDENT_SHEET);
  var headers = sh.getDataRange().getValues()[0];
  Logger.log('Actual headers: ' + JSON.stringify(headers));
  
  // Let's see what the frontend is sending
  var frontendData = {
    Name: 'Test Student',
    '漢字': 'テスト 学生',
    phone: '090-1234-5678',
    email: 'test@example.com',
    Status: 'Active',
    '子': '',
    Payment: 'NEO',
    Group: 'Individual',
    '人数': '1',
    '当日 Cancellation': '未'
  };
  
  Logger.log('Frontend data: ' + JSON.stringify(frontendData));
  
  // Check which fields match
  var missingFields = [];
  var matchingFields = [];
  
  headers.forEach(function(header) {
    if (frontendData.hasOwnProperty(header)) {
      matchingFields.push(header + ': ' + frontendData[header]);
    } else {
      missingFields.push(header);
    }
  });
  
  Logger.log('Matching fields: ' + JSON.stringify(matchingFields));
  Logger.log('Missing fields: ' + JSON.stringify(missingFields));
  
  return {
    headers: headers,
    frontendData: frontendData,
    matchingFields: matchingFields,
    missingFields: missingFields
  };
}

/**
 * Load all student data in bulk for caching system
 * This function fetches complete data for all students at once
 * @returns {Object} Object with all student data keyed by student ID
 */
function getAllStudentDataForCache() {
  Logger.log('=== getAllStudentDataForCache: Starting bulk data load ===');
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var result = {};
    
    // Get all students
    var students = getStudents();
    var headers = students[0];
    var studentRows = students.slice(1);
    
    Logger.log('Found ' + studentRows.length + ' students to process');
    
    // Process each student
    for (var i = 0; i < studentRows.length; i++) {
      var studentRow = studentRows[i];
      var studentId = String(studentRow[headers.indexOf('ID')]);
      var studentName = studentRow[headers.indexOf('Name')];
      
      if (!studentId || !studentName) {
        Logger.log('Skipping student row ' + i + ' - missing ID or name');
        continue;
      }
      
      Logger.log('Processing student ' + (i + 1) + '/' + studentRows.length + ': ' + studentName + ' (ID: ' + studentId + ')');
      
      try {
        // Get complete student data
        var studentData = getStudentDetails(studentId);
        
        if (studentData && studentData.student) {
          result[studentId] = studentData;
          Logger.log('✅ Successfully loaded data for student: ' + studentName);
        } else {
          Logger.log('⚠️ No data returned for student: ' + studentName);
        }
        
        // Add small delay to prevent overwhelming the server
        if (i % 10 === 0 && i > 0) {
          Utilities.sleep(100); // 100ms delay every 10 students
        }
        
      } catch (error) {
        Logger.log('❌ Error processing student ' + studentName + ': ' + error.toString());
        // Continue with next student instead of failing completely
      }
    }
    
    Logger.log('=== Bulk data load complete ===');
    Logger.log('Successfully loaded data for ' + Object.keys(result).length + ' students');
    
    return result;
    
  } catch (error) {
    Logger.log('❌ Fatal error in getAllStudentDataForCache: ' + error.toString());
    return {};
  }
}

/**
 * Get all students from Unpaid sheet (all students in this sheet are unpaid)
 * Column A: Student Name, Column B: Student ID
 * @returns {Array} Array of objects with student name and ID
 */
function getUnpaidStudents() {
  Logger.log('=== getUnpaidStudents: Starting ===');
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var unpaidSheet = ss.getSheetByName('Unpaid');
    
    if (!unpaidSheet) {
      Logger.log('❌ Unpaid sheet not found');
      return [];
    }
    
    // Get only the specific columns we need: A (student name) and B (student ID)
    var lastRow = unpaidSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('No data rows found in Unpaid sheet');
      return [];
    }
    
    // Get only columns A and B (1st and 2nd columns, 1-indexed)
    var studentNameData = unpaidSheet.getRange(1, 1, lastRow, 1).getDisplayValues(); // Column A
    var studentIdData = unpaidSheet.getRange(1, 2, lastRow, 1).getDisplayValues(); // Column B
    
    Logger.log('Retrieved ' + lastRow + ' rows from columns A and B only');
    
    // Convert to flat arrays (remove nested arrays)
    var studentNames = studentNameData.map(function(row) { return row[0]; });
    var studentIds = studentIdData.map(function(row) { return row[0]; });
    
    var unpaidStudents = [];
    
    // Process each row (skip header row, start from index 1)
    for (var i = 1; i < studentNames.length; i++) {
      var studentName = studentNames[i] ? studentNames[i].toString().trim() : '';
      var studentId = studentIds[i] ? studentIds[i].toString().trim() : '';
      
      // Add all students from the sheet (they are all unpaid)
      if (studentId && studentName) {
        unpaidStudents.push({
          id: studentId,
          name: studentName
        });
        
        Logger.log('Found unpaid student: ' + studentName + ' (ID: ' + studentId + ')');
      }
    }
    
    Logger.log('=== getUnpaidStudents: Found ' + unpaidStudents.length + ' unpaid students ===');
    return unpaidStudents;
    
  } catch (error) {
    Logger.log('❌ Error in getUnpaidStudents: ' + error.toString());
    return [];
  }
}

/**
 * Get all students from LessonsMonth sheet (all students in this sheet are unscheduled)
 * Column E: Student Name, Column F: Student ID
 * @returns {Array} Array of objects with student name and ID
 */
function getUnscheduledStudents() {
  Logger.log('=== getUnscheduledStudents: Starting ===');
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var lessonsSheet = ss.getSheetByName('LessonsMonth');
    
    if (!lessonsSheet) {
      Logger.log('❌ LessonsMonth sheet not found');
      return [];
    }
    
    // Get only the specific columns we need: E (student name) and F (student ID)
    var lastRow = lessonsSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('No data rows found in LessonsMonth sheet');
      return [];
    }
    
    // Get only columns E and F (5th and 6th columns, 1-indexed)
    var studentNameData = lessonsSheet.getRange(1, 5, lastRow, 1).getDisplayValues(); // Column E
    var studentIdData = lessonsSheet.getRange(1, 6, lastRow, 1).getDisplayValues(); // Column F
    
    Logger.log('Retrieved ' + lastRow + ' rows from columns E and F only');
    
    // Convert to flat arrays (remove nested arrays)
    var studentNames = studentNameData.map(function(row) { return row[0]; });
    var studentIds = studentIdData.map(function(row) { return row[0]; });
    
    var unscheduledStudents = [];
    
    // Process each row (skip header row, start from index 1)
    for (var i = 1; i < studentNames.length; i++) {
      var studentName = studentNames[i] ? studentNames[i].toString().trim() : '';
      var studentId = studentIds[i] ? studentIds[i].toString().trim() : '';
      
      // Add all students from the sheet (they are all unscheduled)
      if (studentId && studentName) {
        unscheduledStudents.push({
          id: studentId,
          name: studentName
        });
        
        Logger.log('Found unscheduled student: ' + studentName + ' (ID: ' + studentId + ')');
      }
    }
    
    Logger.log('=== getUnscheduledStudents: Found ' + unscheduledStudents.length + ' unscheduled students ===');
    return unscheduledStudents;
    
  } catch (error) {
    Logger.log('❌ Error in getUnscheduledStudents: ' + error.toString());
    return [];
  }
}

/**
 * Optimized version that loads data in smaller batches
 * @param {number} batchSize - Number of students to process per batch
 * @returns {Object} Object with all student data keyed by student ID
 */
/**
 * Monthly task: Check if students have had lessons in the past 2 months
 * If no lessons found, set status to 'Dormant'
 * This function should be triggered monthly via Google Apps Script
 */
function monthlyStatusCheckForInactiveStudents() {
  Logger.log('=== Monthly Status Check: Setting inactive students to Dormant ===');
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var studentSheet = ss.getSheetByName(STUDENT_SHEET);
    var monthlyScheduleSheet = ss.getSheetByName('MonthlySchedule');
    
    if (!studentSheet || !monthlyScheduleSheet) {
      Logger.log('❌ Required sheets not found');
      return;
    }
    
    // Get current date and calculate 2 months ago
    var today = new Date();
    var twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    var currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    var twoMonthsAgoMonth = twoMonthsAgo.getFullYear() + '-' + String(twoMonthsAgo.getMonth() + 1).padStart(2, '0');
    
    Logger.log('Checking lessons from ' + twoMonthsAgoMonth + ' to ' + currentMonth);
    
    // Get all students
    var studentData = studentSheet.getDataRange().getValues();
    var headers = studentData[0];
    var idCol = headers.indexOf('ID');
    var nameCol = headers.indexOf('Name');
    var statusCol = headers.indexOf('Status');
    
    // Get MonthlySchedule data
    var scheduleData = monthlyScheduleSheet.getDataRange().getValues();
    var scheduleHeaders = scheduleData[0];
    var studentNameCol = scheduleHeaders.indexOf('StudentName');
    var startCol = scheduleHeaders.indexOf('Start');
    
    var studentsToUpdate = [];
    
    // Check each student
    for (var i = 1; i < studentData.length; i++) {
      var studentId = studentData[i][idCol];
      var studentName = studentData[i][nameCol];
      var currentStatus = studentData[i][statusCol];
      
      // Skip if already Dormant or Demo
      if (currentStatus === 'Dormant' || currentStatus === 'Demo') {
        continue;
      }
      
      // Check if student has lessons in the past 2 months
      var hasLessons = false;
      for (var j = 1; j < scheduleData.length; j++) {
        var lessonStudentName = scheduleData[j][studentNameCol];
        var lessonStart = scheduleData[j][startCol];
        
        if (lessonStudentName === studentName && lessonStart) {
          // Parse lesson date (DD/MM/YYYY format)
          var dateParts = lessonStart.toString().split(' ')[0].split('/');
          if (dateParts.length === 3) {
            var day = parseInt(dateParts[0]);
            var month = parseInt(dateParts[1]);
            var year = parseInt(dateParts[2]);
            var lessonDate = new Date(year, month - 1, day);
            var lessonMonth = year + '-' + String(month).padStart(2, '0');
            
            // Check if lesson is within the past 2 months
            if (lessonMonth >= twoMonthsAgoMonth && lessonMonth <= currentMonth) {
              hasLessons = true;
              break;
            }
          }
        }
      }
      
      // If no lessons found, mark for status update
      if (!hasLessons) {
        studentsToUpdate.push({
          row: i + 1,
          id: studentId,
          name: studentName,
          currentStatus: currentStatus
        });
      }
    }
    
    // Update status to Dormant for students without lessons
    var updatedCount = 0;
    for (var k = 0; k < studentsToUpdate.length; k++) {
      var student = studentsToUpdate[k];
      studentSheet.getRange(student.row, statusCol + 1).setValue('Dormant');
      Logger.log('📝 Updated ' + student.name + ' (ID: ' + student.id + ') from ' + student.currentStatus + ' to Dormant');
      updatedCount++;
    }
    
    Logger.log('✅ Monthly check completed. Updated ' + updatedCount + ' students to Dormant status');
    
  } catch (error) {
    Logger.log('❌ Error in monthly status check: ' + error.toString());
  }
}

/**
 * Daily task: Check if students have lessons this month
 * If lessons found, set status to 'Active'
 * This function should be triggered daily via Google Apps Script
 */
function dailyStatusCheckForActiveStudents() {
  Logger.log('=== Daily Status Check: Setting students with current month lessons to Active ===');
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var studentSheet = ss.getSheetByName(STUDENT_SHEET);
    var monthlyScheduleSheet = ss.getSheetByName('MonthlySchedule');
    
    if (!studentSheet || !monthlyScheduleSheet) {
      Logger.log('❌ Required sheets not found');
      return;
    }
    
    // Get current month
    var today = new Date();
    var currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    
    Logger.log('Checking lessons for current month: ' + currentMonth);
    
    // Get all students
    var studentData = studentSheet.getDataRange().getValues();
    var headers = studentData[0];
    var idCol = headers.indexOf('ID');
    var nameCol = headers.indexOf('Name');
    var statusCol = headers.indexOf('Status');
    
    // Get MonthlySchedule data
    var scheduleData = monthlyScheduleSheet.getDataRange().getValues();
    var scheduleHeaders = scheduleData[0];
    var studentNameCol = scheduleHeaders.indexOf('StudentName');
    var startCol = scheduleHeaders.indexOf('Start');
    
    var studentsToUpdate = [];
    
    // Check each student
    for (var i = 1; i < studentData.length; i++) {
      var studentId = studentData[i][idCol];
      var studentName = studentData[i][nameCol];
      var currentStatus = studentData[i][statusCol];
      
      // Skip if already Active
      if (currentStatus === 'Active') {
        continue;
      }
      
      // Check if student has lessons this month
      var hasLessonsThisMonth = false;
      for (var j = 1; j < scheduleData.length; j++) {
        var lessonStudentName = scheduleData[j][studentNameCol];
        var lessonStart = scheduleData[j][startCol];
        
        if (lessonStudentName === studentName && lessonStart) {
          // Parse lesson date (DD/MM/YYYY format)
          var dateParts = lessonStart.toString().split(' ')[0].split('/');
          if (dateParts.length === 3) {
            var day = parseInt(dateParts[0]);
            var month = parseInt(dateParts[1]);
            var year = parseInt(dateParts[2]);
            var lessonMonth = year + '-' + String(month).padStart(2, '0');
            
            // Check if lesson is in current month
            if (lessonMonth === currentMonth) {
              hasLessonsThisMonth = true;
              break;
            }
          }
        }
      }
      
      // If lessons found this month, mark for status update
      if (hasLessonsThisMonth) {
        studentsToUpdate.push({
          row: i + 1,
          id: studentId,
          name: studentName,
          currentStatus: currentStatus
        });
      }
    }
    
    // Update status to Active for students with current month lessons
    var updatedCount = 0;
    for (var k = 0; k < studentsToUpdate.length; k++) {
      var student = studentsToUpdate[k];
      studentSheet.getRange(student.row, statusCol + 1).setValue('Active');
      Logger.log('📝 Updated ' + student.name + ' (ID: ' + student.id + ') from ' + student.currentStatus + ' to Active');
      updatedCount++;
    }
    
    Logger.log('✅ Daily check completed. Updated ' + updatedCount + ' students to Active status');
    
  } catch (error) {
    Logger.log('❌ Error in daily status check: ' + error.toString());
  }
}

/**
 * Helper function to set up automated triggers for status management
 * Call this once to set up the monthly and daily triggers
 */
function setupStatusManagementTriggers() {
  Logger.log('=== Setting up Status Management Triggers ===');
  
  try {
    // Delete existing triggers first
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      var trigger = triggers[i];
      if (trigger.getHandlerFunction() === 'monthlyStatusCheckForInactiveStudents' || 
          trigger.getHandlerFunction() === 'dailyStatusCheckForActiveStudents') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log('🗑️ Deleted existing trigger: ' + trigger.getHandlerFunction());
      }
    }
    
    // Create monthly trigger (runs on the 1st of each month at 9 AM)
    ScriptApp.newTrigger('monthlyStatusCheckForInactiveStudents')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    Logger.log('✅ Created monthly trigger for inactive student check');
    
    // Create daily trigger (runs every day at 8 AM)
    ScriptApp.newTrigger('dailyStatusCheckForActiveStudents')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    Logger.log('✅ Created daily trigger for active student check');
    
    Logger.log('🎉 All triggers set up successfully!');
    Logger.log('📅 Monthly check: 1st of each month at 9 AM');
    Logger.log('📅 Daily check: Every day at 8 AM');
    
  } catch (error) {
    Logger.log('❌ Error setting up triggers: ' + error.toString());
  }
}

// ===== Lesson Management Functions =====

/**
 * Cancel a lesson by updating its status in Google Calendar
 * @param {string} eventId - Google Calendar event ID
 * @param {string} reason - Cancellation reason
 * @param {string} studentId - Student ID for logging
 * @returns {Object} Success/failure status
 */
function cancelLesson(eventId, reason, studentId) {
  try {
    Logger.log('=== cancelLesson called ===');
    Logger.log('Event ID: ' + eventId);
    Logger.log('Reason: ' + reason);
    Logger.log('Student ID: ' + studentId);
    
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    var event = calendar.getEventById(eventId);
    
    if (!event) {
      Logger.log('Event not found: ' + eventId);
      return { success: false, error: 'Event not found' };
    }
    
    // Capture start time for cache updates
    var startTime = event.getStartTime();

    // Update event title to show cancelled status
    var originalTitle = event.getTitle() || '';
    // Strip any existing cancellation/move prefixes
    var baseTitle = originalTitle.replace(/^\[(CANCELLED|MOVED TO[^\]]*)\]\s*/i, '').trim();
    // Append cancelled suffix to preserve original ordering (incl. 子 marker)
    var cancelledTitle = `${baseTitle} [Cancelled]`;
    event.setTitle(cancelledTitle);
    // Graphite color (8) for cancelled lessons
    event.setColor('8');
    
    // Add cancellation note to description
    var originalDescription = event.getDescription() || '';
    var cancellationNote = '\n\n--- CANCELLATION ---\nReason: ' + reason + '\nCancelled by: ' + getCurrentStaffName() + '\nDate: ' + new Date().toLocaleString();
    event.setDescription(originalDescription + cancellationNote);
    
    // Log the action
    logLessonAction(studentId, eventId, 'cancel', null, null, reason);
    
    // Get lesson details to determine if it was a kids lesson
    var isKidsLesson = false;
    if (event) {
      var titleForKids = event.getTitle() || '';
      isKidsLesson = titleForKids.indexOf('子') !== -1;
    }
    
    // Update availability cache
    updateAvailabilityForTimeSlot(startTime, false, isKidsLesson);
    
    // Write-through to MonthlySchedule
    updateMonthlyScheduleStatus_(eventId, 'cancelled', cancelledTitle, startTime, event.getEndTime());
    
    Logger.log('Lesson cancelled successfully: ' + eventId);
    return { success: true, message: 'Lesson cancelled successfully' };
    
  } catch (error) {
    Logger.log('Error cancelling lesson: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Reschedule a lesson to a new date/time
 * @param {string} eventId - Google Calendar event ID
 * @param {string} newDateTime - New date/time in ISO format
 * @param {string} reason - Reschedule reason
 * @param {string} studentId - Student ID for logging
 * @returns {Object} Success/failure status
 */
function rescheduleLesson(eventId, newDateTime, reason, studentId) {
  try {
    Logger.log('=== rescheduleLesson called ===');
    Logger.log('Event ID: ' + eventId);
    Logger.log('New DateTime: ' + newDateTime);
    Logger.log('Reason: ' + reason);
    Logger.log('Student ID: ' + studentId);
    
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    var originalEvent = calendar.getEventById(eventId);
    
    if (!originalEvent) {
      Logger.log('Event not found: ' + eventId);
      return { success: false, error: 'Event not found' };
    }
    
    var oldStartTime = originalEvent.getStartTime();
    var oldEndTime = originalEvent.getEndTime();
    var duration = oldEndTime.getTime() - oldStartTime.getTime();
    var originalTitle = originalEvent.getTitle();
    var originalDescription = originalEvent.getDescription() || '';
    
    // Create new start and end times
    var newStartTime = new Date(newDateTime);
    var newEndTime = new Date(newStartTime.getTime() + duration);
    
    // Format new time for display in description
    var tz = Session.getScriptTimeZone();
    var newTimeStr = Utilities.formatDate(newStartTime, tz, 'yyyy-MM-dd HH:mm');
    
    // Mark original event as rescheduled (keep it in calendar, greyed out)
    // Add [RESCHEDULED] prefix to title
    var rescheduledTitle = '[RESCHEDULED] ' + originalTitle;
    originalEvent.setTitle(rescheduledTitle);
    
    // Add "Moved to XXX" note to description
    var movedNote = '\n\n--- RESCHEDULED ---\nMoved to: ' + newTimeStr + '\nReason: ' + reason + '\nRescheduled by: ' + getCurrentStaffName() + '\nDate: ' + new Date().toLocaleString();
    originalEvent.setDescription(originalDescription + movedNote);
    
    // Grey out the original event (use Graphite color 8) and label moved-to date
    originalEvent.setColor('8');
    var movedTitle = '[MOVED TO ' + newTimeStr + '] ' + originalTitle;
    originalEvent.setTitle(movedTitle);
    
    // Create new event at the new time
    var newEvent = calendar.createEvent(originalTitle, newStartTime, newEndTime, {
      description: originalDescription + '\n\n--- RESCHEDULED FROM ---\nOriginal Time: ' + Utilities.formatDate(oldStartTime, tz, 'yyyy-MM-dd HH:mm') + '\nReason: ' + reason + '\nRescheduled by: ' + getCurrentStaffName() + '\nDate: ' + new Date().toLocaleString()
    });
    
    // Determine if it's a kids lesson from original title
    var isKidsLesson = originalTitle.indexOf('子') !== -1;
    
    // Update availability cache for old time slot (decrease lesson count)
    updateAvailabilityForTimeSlot(oldStartTime, false, isKidsLesson);
    
    // Update availability cache for new time slot (increase lesson count)
    updateAvailabilityForTimeSlot(newStartTime, true, isKidsLesson);
    
    // Log the action (log both old and new event IDs)
    logLessonAction(studentId, eventId, 'reschedule', oldStartTime.toISOString(), newStartTime.toISOString(), reason);
    logLessonAction(studentId, newEvent.getId(), 'reschedule_new', oldStartTime.toISOString(), newStartTime.toISOString(), 'New event created from reschedule');
    
    // Write-through updates to MonthlySchedule
    updateMonthlyScheduleStatus_(eventId, 'rescheduled', rescheduledTitle, oldStartTime, oldEndTime);
    upsertMonthlyScheduleRow_({
      eventId: newEvent.getId(),
      title: originalTitle,
      startTime: newStartTime,
      endTime: newEndTime,
      status: 'scheduled',
      studentName: originalTitle, // fallback
      isKidsLesson: isKidsLesson,
      teacherName: ''
    });
    
    Logger.log('Lesson rescheduled successfully. Original event: ' + eventId + ', New event: ' + newEvent.getId());
    return { 
      success: true, 
      message: 'Lesson rescheduled successfully',
      originalEventId: eventId,
      newEventId: newEvent.getId(),
      oldTime: oldStartTime.toISOString(),
      newTime: newStartTime.toISOString()
    };
    
  } catch (error) {
    Logger.log('Error rescheduling lesson: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

/**
 * Remove a lesson completely from Google Calendar
 * @param {string} eventId - Google Calendar event ID
 * @param {string} reason - Removal reason
 * @param {string} studentId - Student ID for logging
 * @returns {Object} Success/failure status
 */
function removeLesson(eventId, reason, studentId) {
  try {
    Logger.log('=== removeLesson called ===');
    Logger.log('Event ID: ' + eventId);
    Logger.log('Reason: ' + reason);
    Logger.log('Student ID: ' + studentId);
    
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    var event = calendar.getEventById(eventId);
    
    if (!event) {
      Logger.log('Event not found: ' + eventId);
      return { success: false, error: 'Event not found' };
    }
    
    // Capture start time before deletion for logging/cache updates
    var startTime = event.getStartTime();
    
    // Log the action before deletion
    logLessonAction(studentId, eventId, 'remove', startTime.toISOString(), null, reason);
    
    // Determine if it's a kids lesson before deletion (title may contain 子)
    var originalTitle = event.getTitle() || '';
    var isKidsLesson = originalTitle.indexOf('子') !== -1;
    
    // Delete the event
    event.deleteEvent();

    // Update availability cache (decrement the slot for the removed lesson)
    updateAvailabilityForTimeSlot(startTime, false, isKidsLesson);

    // Write-through to MonthlySchedule
    removeMonthlyScheduleRow_(eventId);
    
    Logger.log('Lesson removed successfully: ' + eventId);
    return { success: true, message: 'Lesson removed successfully' };
    
  } catch (error) {
    Logger.log('Error removing lesson: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Log lesson actions for audit trail
 * @param {string} studentId - Student ID
 * @param {string} eventId - Google Calendar event ID
 * @param {string} actionType - Type of action (cancel, reschedule, remove)
 * @param {string} oldDateTime - Old date/time (for reschedule)
 * @param {string} newDateTime - New date/time (for reschedule)
 * @param {string} reason - Action reason
 */
function logLessonAction(studentId, eventId, actionType, oldDateTime, newDateTime, reason) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName('LessonActions') || ss.insertSheet('LessonActions');
    
    // Set up headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 8).setValues([[
        'ActionID', 'StudentID', 'EventID', 'ActionType', 'OldDateTime', 'NewDateTime', 'Reason', 'StaffMember', 'Timestamp'
      ]]);
    }
    
    // Generate unique action ID
    var actionId = 'LA_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Add the log entry
    sheet.appendRow([
      actionId,
      studentId,
      eventId,
      actionType,
      oldDateTime || '',
      newDateTime || '',
      reason || '',
      getCurrentStaffName(),
      new Date().toISOString()
    ]);
    
    Logger.log('Lesson action logged: ' + actionId);
    
  } catch (error) {
    Logger.log('Error logging lesson action: ' + error.toString());
  }
}

/**
 * Get lesson event details by event ID
 * @param {string} eventId - Google Calendar event ID
 * @returns {Object} Event details or error
 */
function getLessonEventDetails(eventId) {
  try {
    Logger.log('=== getLessonEventDetails called ===');
    Logger.log('Event ID: ' + eventId);
    
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    var event = calendar.getEventById(eventId);
    
    if (!event) {
      Logger.log('Event not found: ' + eventId);
      return { success: false, error: 'Event not found' };
    }
    
    var eventDetails = {
      success: true,
      id: event.getId(),
      title: event.getTitle(),
      startTime: event.getStartTime().toISOString(),
      endTime: event.getEndTime().toISOString(),
      description: event.getDescription() || '',
      location: event.getLocation() || '',
      guests: event.getGuestList().map(function(guest) { return guest.getEmail(); }),
      isAllDay: event.isAllDayEvent()
    };
    
    Logger.log('Event details retrieved: ' + eventId);
    return eventDetails;
    
  } catch (error) {
    Logger.log('Error getting event details: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Book a new lesson by creating a Google Calendar event
 * @param {string} studentId - Student ID
 * @param {string} dateTime - Date and time in ISO format
 * @param {number} duration - Duration in minutes
 * @param {string} lessonType - Type of lesson (Individual/Group)
 * @param {string} notes - Additional notes
 * @returns {Object} Success/failure status
 */
function bookLesson(studentId, dateTime, duration, lessonType, notes, teacherName) {
  try {
    Logger.log('Booking lesson for student: ' + studentId);
    
    // Get student details
    var student = getStudentById(studentId);
    if (!student) {
      Logger.log('Student not found: ' + studentId);
      return { success: false, error: 'Student not found' };
    }
    
    // Create start and end times
    var startTime = new Date(dateTime);
    var endTime = new Date(startTime.getTime() + (50 * 60 * 1000)); // Fixed 50 minutes duration
    
    // Validate: Lessons must be booked at least 1 hour in advance
    var now = new Date();
    var oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour in milliseconds
    if (startTime < oneHourFromNow) {
      Logger.log('BLOCKED: Lesson time is less than 1 hour away');
      var timeUntilLesson = Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)); // minutes
      return { 
        success: false, 
        error: 'Lessons must be booked at least 1 hour in advance. Selected time is only ' + timeUntilLesson + ' minutes away.' 
      };
    }
    
    // Check if student is a child
    var isChildStudent = !!(student['子'] === '子' || student.child === true || student.child === '子');
    
    // Validate kids/adults separation before booking
    if (isChildStudent) {
      var existingLessons = getExistingLessonsFromSheet(startTime);
      var eventDate = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var eventTime = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
      
      // Parse existing lessons if it's a JSON string
      var existingLessonsObj = {};
      if (typeof existingLessons === 'string') {
        try {
          existingLessonsObj = JSON.parse(existingLessons);
        } catch (e) {
          Logger.log('Could not parse existing lessons: ' + e.toString());
          existingLessonsObj = {};
        }
      } else {
        existingLessonsObj = existingLessons || {};
      }
      
      // Check if this slot has adult lessons
      if (existingLessonsObj[eventDate] && existingLessonsObj[eventDate][eventTime]) {
        var lessons = existingLessonsObj[eventDate][eventTime];
        if (Array.isArray(lessons) && lessons.length > 0) {
          var hasAdultLesson = lessons.some(function(lesson) {
            var isKidsLesson = lesson.isKidsLesson === true || lesson.isKidsLesson === '子';
            return !isKidsLesson;
          });
          
          if (hasAdultLesson) {
            Logger.log('BLOCKED: Cannot book kids lesson in slot with adult lessons');
            return { 
              success: false, 
              error: 'Cannot book kids lesson in a time slot that contains adult lessons. Kids and adults must be kept separate.' 
            };
          }
        }
      }
    }
    
    // Determine which calendar to use based on teacher
    // Sham can be available for regular lessons (uses regular calendar) or Sham-only lessons (uses Sham's calendar)
    // For regular lessons with Sham, use regular calendar
    var calendarId = LESSON_CALENDAR_ID;
    
    // Check if teacher is selected and available
    if (teacherName && teacherName.trim()) {
      var teacherAvailable = checkTeacherAvailability(teacherName.trim(), startTime, endTime, false); // false = regular lesson
      if (!teacherAvailable) {
        Logger.log('BLOCKED: ' + teacherName + ' is not available at this time');
        return { 
          success: false, 
          error: teacherName + ' is not available at the selected time. Please choose a different time slot.' 
        };
      }
    }
    
    var calendar = CalendarApp.getCalendarById(calendarId);
    
    // Create event title (add 子 marker if child)
    var studentName = student.Name || student.name || 'Unknown Student';
    // Build title: child marker as prefix, lesson type suffix
    var title = (isChildStudent ? '子 ' : '') + studentName + ' (' + lessonType + ')';
    
    // Create event description
    var description = 'Booked by: ' + getCurrentStaffName() + '\n';
    description += 'Booked on: ' + new Date().toLocaleString() + '\n';
    if (teacherName && teacherName.trim()) {
      description += 'Teacher: ' + teacherName.trim() + '\n';
    }
    if (notes) {
      description += '\nNotes: ' + notes;
    }
    
    // Create the calendar event
    var event = calendar.createEvent(title, startTime, endTime, {
      description: description
    });
    
    // Log the action
    logLessonAction(studentId, event.getId(), 'book', null, startTime.toISOString(), 'New lesson booked');
    
    Logger.log('Lesson booked successfully: ' + event.getId());
    
    // Update availability cache
    updateAvailabilityForTimeSlot(startTime, true, isChildStudent);
    
    // Write-through to MonthlySchedule (avoid full refresh)
    upsertMonthlyScheduleRow_({
      eventId: event.getId(),
      title: title,
      startTime: startTime,
      endTime: endTime,
      status: 'scheduled',
      studentName: studentName,
      isKidsLesson: isChildStudent,
      teacherName: teacherName && teacherName.trim() ? teacherName.trim() : ''
    });
    
    return { 
      success: true, 
      message: 'Lesson booked successfully',
      eventId: event.getId(),
      title: title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
    
  } catch (error) {
    Logger.log('Error booking lesson: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}


/**
 * Book a reserved lesson (tentative booking)
 * @param {string} studentId - Student ID
 * @param {string} dateTime - Date and time in ISO format
 * @param {number} duration - Duration in minutes
 * @param {string} lessonType - Type of lesson (Individual/Group)
 * @param {string} notes - Additional notes
 * @param {number} totalLessons - Total lessons for the month
 * @returns {Object} Success/failure status
 */
function bookReservedLesson(studentId, dateTime, duration, lessonType, notes, totalLessons, teacherName) {
  try {
    Logger.log('Booking reserved lesson for student: ' + studentId);
    
    // Get student details
    var student = getStudentById(studentId);
    if (!student) {
      Logger.log('Student not found: ' + studentId);
      return { success: false, error: 'Student not found' };
    }
    
    // Create start and end times
    var startTime = new Date(dateTime);
    var endTime = new Date(startTime.getTime() + (50 * 60 * 1000)); // Fixed 50 minutes duration
    
    // Validate: Lessons must be booked at least 1 hour in advance
    var now = new Date();
    var oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour in milliseconds
    if (startTime < oneHourFromNow) {
      Logger.log('BLOCKED: Reserved lesson time is less than 1 hour away');
      var timeUntilLesson = Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)); // minutes
      return { 
        success: false, 
        error: 'Lessons must be booked at least 1 hour in advance. Selected time is only ' + timeUntilLesson + ' minutes away.' 
      };
    }
    
    // Check if student is a child
    var isChildStudent = !!(student['子'] === '子' || student.child === true || student.child === '子');
    
    // Validate kids/adults separation before booking
    if (isChildStudent) {
      var existingLessons = getExistingLessonsFromSheet(startTime);
      var eventDate = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var eventTime = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
      
      // Parse existing lessons if it's a JSON string
      var existingLessonsObj = {};
      if (typeof existingLessons === 'string') {
        try {
          existingLessonsObj = JSON.parse(existingLessons);
        } catch (e) {
          Logger.log('Could not parse existing lessons: ' + e.toString());
          existingLessonsObj = {};
        }
      } else {
        existingLessonsObj = existingLessons || {};
      }
      
      // Check if this slot has adult lessons
      if (existingLessonsObj[eventDate] && existingLessonsObj[eventDate][eventTime]) {
        var lessons = existingLessonsObj[eventDate][eventTime];
        if (Array.isArray(lessons) && lessons.length > 0) {
          var hasAdultLesson = lessons.some(function(lesson) {
            var isKidsLesson = lesson.isKidsLesson === true || lesson.isKidsLesson === '子';
            return !isKidsLesson;
          });
          
          if (hasAdultLesson) {
            Logger.log('BLOCKED: Cannot book kids reserved lesson in slot with adult lessons');
            return { 
              success: false, 
              error: 'Cannot book kids lesson in a time slot that contains adult lessons. Kids and adults must be kept separate.' 
            };
          }
        }
      }
    }
    
    // Determine which calendar to use based on teacher
    // Sham can be available for regular lessons (uses regular calendar) or Sham-only lessons (uses Sham's calendar)
    // For regular lessons with Sham, use regular calendar
    var calendarId = LESSON_CALENDAR_ID;
    
    // Check if teacher is selected and available
    if (teacherName && teacherName.trim()) {
      var teacherAvailable = checkTeacherAvailability(teacherName.trim(), startTime, endTime, false); // false = regular lesson
      if (!teacherAvailable) {
        Logger.log('BLOCKED: ' + teacherName + ' is not available at this time');
        return { 
          success: false, 
          error: teacherName + ' is not available at the selected time. Please choose a different time slot.' 
        };
      }
    }
    
    var calendar = CalendarApp.getCalendarById(calendarId);
    
    // Create event title (add 子 marker if child, and "placeholder" for reserved)
    var studentName = student.Name || student.name || 'Unknown Student';
    // Build title: child marker as prefix, lesson type suffix
    var title = (isChildStudent ? '子 ' : '') + studentName + ' (' + lessonType + ') [placeholder]';
    
    // Create event description
    var description = 'Reserved booking\n';
    description += 'Booked by: ' + getCurrentStaffName() + '\n';
    description += 'Booked on: ' + new Date().toLocaleString() + '\n';
    if (teacherName && teacherName.trim()) {
      description += 'Teacher: ' + teacherName.trim() + '\n';
    }
    if (totalLessons) {
      description += 'Total lessons for month: ' + totalLessons + '\n';
    }
    if (notes) {
      description += '\nNotes: ' + notes;
    }
    
    // Create the calendar event with orange/tomato color for reserved
    var event = calendar.createEvent(title, startTime, endTime, {
      description: description
    });
    
    // Set color to orange/tomato (11) for reserved/placeholder
    event.setColor('11');
    
    // Log the action
    logLessonAction(studentId, event.getId(), 'book', null, startTime.toISOString(), 'Reserved lesson booked');
    
    Logger.log('Reserved lesson booked successfully: ' + event.getId());
    
    // Update availability cache
    updateAvailabilityForTimeSlot(startTime, true, isChildStudent);
    
    // Write-through to MonthlySchedule (avoid full refresh)
    upsertMonthlyScheduleRow_({
      eventId: event.getId(),
      title: title,
      startTime: startTime,
      endTime: endTime,
      status: 'scheduled',
      studentName: studentName,
      isKidsLesson: isChildStudent,
      teacherName: teacherName && teacherName.trim() ? teacherName.trim() : ''
    });
    
    return { 
      success: true, 
      message: 'Reserved lesson booked successfully',
      eventId: event.getId(),
      title: title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
    
  } catch (error) {
    Logger.log('Error booking reserved lesson: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get teacher calendar IDs from the spreadsheet
 * @returns {Array} Array of teacher calendar IDs
 */
function getTeacherCalendarIds() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName(STUDENT_SHEET);
    if (!sheet) {
      Logger.log('Student sheet not found');
      return [];
    }
    
    var data = sheet.getDataRange().getDisplayValues();
    var headers = data[0];
    var teacherCalendarIndex = headers.indexOf('Teacher Calendar ID');
    
    if (teacherCalendarIndex === -1) {
      Logger.log('Teacher Calendar ID column not found');
      return [];
    }
    
    var teacherCalendars = [];
    for (var i = 1; i < data.length; i++) {
      var calendarId = data[i][teacherCalendarIndex];
      if (calendarId && calendarId.trim() !== '') {
        teacherCalendars.push(calendarId.trim());
      }
    }
    
    // Remove duplicates
    teacherCalendars = [...new Set(teacherCalendars)];
    Logger.log('Found ' + teacherCalendars.length + ' unique teacher calendars');
    
    return teacherCalendars;
    
  } catch (error) {
    Logger.log('Error getting teacher calendar IDs: ' + error.toString());
    return [];
  }
}

/**
 * Check for age group conflicts in existing lessons
 * @param {Date} startTime - Lesson start time
 * @param {Date} endTime - Lesson end time
 * @param {string} studentType - 'child' or 'adult'
 * @returns {Object} Conflict status
 */
function checkAgeGroupConflicts(startTime, endTime, studentType) {
  try {
    Logger.log('=== checkAgeGroupConflicts called ===');
    Logger.log('Start time: ' + startTime.toISOString());
    Logger.log('End time: ' + endTime.toISOString());
    Logger.log('Student type: ' + studentType);
    
    // Get existing lessons from MonthlySchedule sheet
    var existingLessons = getExistingLessonsFromSheet(startTime);
    
    // Parse existing lessons if it's a JSON string
    var existingLessonsObj = {};
    if (typeof existingLessons === 'string') {
      try {
        existingLessonsObj = JSON.parse(existingLessons);
      } catch (e) {
        Logger.log('Could not parse existing lessons: ' + e.toString());
        existingLessonsObj = {};
      }
    } else {
      existingLessonsObj = existingLessons || {};
    }
    
    // Check for conflicts in the time range
    var eventDate = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var eventTime = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
    
    if (existingLessonsObj[eventDate] && existingLessonsObj[eventDate][eventTime]) {
      var lessons = existingLessonsObj[eventDate][eventTime];
      
      if (Array.isArray(lessons) && lessons.length > 0) {
        // If student is a child, check if any existing lesson is an adult lesson
        if (studentType === 'child') {
          var hasAdultLesson = lessons.some(function(lesson) {
            var isKidsLesson = lesson.isKidsLesson === true || lesson.isKidsLesson === '子';
            return !isKidsLesson;
          });
          
          if (hasAdultLesson) {
            Logger.log('Found adult lesson conflict for child student');
            return {
              hasConflict: true,
              reason: 'Time slot contains adult lessons - kids and adults cannot be booked together'
            };
          }
        } else {
          // If student is an adult, check if any existing lesson is a kids lesson
          var hasKidsLesson = lessons.some(function(lesson) {
            var isKidsLesson = lesson.isKidsLesson === true || lesson.isKidsLesson === '子';
            return isKidsLesson;
          });
          
          if (hasKidsLesson) {
            Logger.log('Found kids lesson conflict for adult student');
            return {
              hasConflict: true,
              reason: 'Time slot contains kids lessons - kids and adults cannot be booked together'
            };
          }
        }
        
        Logger.log('Found existing lessons but no age group conflict');
        return { hasConflict: false, reason: 'No age group conflicts' };
      }
    }
    
    Logger.log('No age group conflicts found');
    return { hasConflict: false, reason: 'No conflicts' };
    
  } catch (error) {
    Logger.log('Error checking age group conflicts: ' + error.toString());
    return { hasConflict: false, reason: 'Error checking conflicts: ' + error.toString() };
  }
}

/**
 * Get student by name (helper function for age group checking)
 * @param {string} studentName - Student name to search for
 * @returns {Object|null} Student data or null if not found
 */
function getStudentByName(studentName) {
  try {
    var students = getStudents();
    var headers = students[0];
    var nameIndex = headers.indexOf('Name');
    
    if (nameIndex === -1) {
      return null;
    }
    
    for (var i = 1; i < students.length; i++) {
      var studentData = students[i];
      var name = studentData[nameIndex];
      
      if (name && name.trim() === studentName.trim()) {
        var student = {};
        headers.forEach(function(header, index) {
          student[header] = studentData[index];
        });
        return student;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('Error getting student by name: ' + error.toString());
    return null;
  }
}


/**
 * Get existing lessons from MonthlySchedule sheet for a given week
 * @param {Date} startDate - Start date of the week
 * @returns {Object} Map of existing lessons by date and time
 */
function getExistingLessonsFromSheet(startDate) {
  try {
    Logger.log('=== getExistingLessonsFromSheet called ===');
    Logger.log('Start date: ' + startDate);
    Logger.log('Function is being called from frontend');
    
    // For testing, let's return only one day's data
    Logger.log('TESTING: Returning only one day of data to test data size limits');
    
    // Open the spreadsheet and get the Lessons sheet
    var ss = SpreadsheetApp.openById(SS_ID);
    Logger.log('Spreadsheet opened successfully');
    
    var sheet = ss.getSheetByName('MonthlySchedule');
    Logger.log('Looking for MonthlySchedule sheet...');
    
    if (!sheet) {
      Logger.log('ERROR: MonthlySchedule sheet not found');
      Logger.log('Available sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
      
      // Try to find MonthlySchedule first, then other sheets
      var allSheets = ss.getSheets();
      
      // First priority: MonthlySchedule
      for (var i = 0; i < allSheets.length; i++) {
        var sheetName = allSheets[i].getName();
        if (sheetName === 'MonthlySchedule') {
          sheet = allSheets[i];
          Logger.log('Found MonthlySchedule sheet: ' + sheetName);
          break;
        }
      }
      
      // If MonthlySchedule not found, try other sheets
      if (!sheet) {
        for (var i = 0; i < allSheets.length; i++) {
          var sheetName = allSheets[i].getName();
          Logger.log('Checking alternative sheet: ' + sheetName);
          if (sheetName.toLowerCase().includes('lesson') || 
              sheetName.toLowerCase().includes('schedule') ||
              sheetName.toLowerCase().includes('monthly')) {
            sheet = allSheets[i];
            Logger.log('Using alternative sheet: ' + sheetName);
            break;
          }
        }
      }
      
      if (!sheet) {
        Logger.log('No suitable sheet found');
        return {};
      }
    }
    
    Logger.log('Sheet found successfully: ' + sheet.getName());
    
    // Get the data range
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    
    if (lastRow <= 1) {
      Logger.log('No data in Lessons sheet');
      return {};
    }
    
    Logger.log('Reading data from rows 1 to ' + lastRow + ', columns 1 to ' + lastCol);
    
    // Get all data from the sheet
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    // Find the column indices
    var startTimeCol = headers.indexOf('Start');
    var endTimeCol = headers.indexOf('End');
    var studentNameCol = headers.indexOf('StudentName');
    var statusCol = headers.indexOf('Status');
    var eventIdCol = headers.indexOf('EventID');
    var titleCol = headers.indexOf('Title');
    var isKidsLessonCol = headers.indexOf('IsKidsLesson');  // NEW COLUMN
    
    Logger.log('Column indices - Start: ' + startTimeCol + ', End: ' + endTimeCol + ', StudentName: ' + studentNameCol + ', Status: ' + statusCol + ', EventID: ' + eventIdCol + ', Title: ' + titleCol + ', IsKidsLesson: ' + isKidsLessonCol);
    
    if (startTimeCol === -1 || endTimeCol === -1 || studentNameCol === -1 || statusCol === -1) {
      Logger.log('ERROR: Required columns not found');
      Logger.log('Available headers: ' + JSON.stringify(headers));
      Logger.log('Start Time col: ' + startTimeCol + ', End Time col: ' + endTimeCol + ', Student Name col: ' + studentNameCol + ', Status col: ' + statusCol);
      return {};
    }
    
    var lessonsByDay = {};
    var totalLessons = 0;
    
    // Parse the start date to get the week range
    var weekStart = new Date(startDate);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    var weekStartStr = Utilities.formatDate(weekStart, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var weekEndStr = Utilities.formatDate(weekEnd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    Logger.log('Week range: ' + weekStartStr + ' to ' + weekEndStr);
    Logger.log('Total rows to process: ' + (data.length - 1));
    
    // Process each row (skip header row)
    Logger.log('Starting to process ' + (data.length - 1) + ' data rows');
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var startTime = row[startTimeCol];
      var endTime = row[endTimeCol];
      var studentName = row[studentNameCol];
      var status = row[statusCol];
      
      Logger.log('Row ' + i + ': startTime=' + startTime + ', studentName=' + studentName + ', status=' + status);
      
      if (!startTime || !studentName) {
        Logger.log('Skipping row ' + i + ' - missing startTime or studentName');
        continue;
      }
      
      // Parse the start time
      var startDateObj = new Date(startTime);
      if (isNaN(startDateObj.getTime())) continue;
      
      // Format date as YYYY-MM-DD
      var eventDate = Utilities.formatDate(startDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      // Check if lesson is within the week range
      if (eventDate < weekStartStr || eventDate >= weekEndStr) {
        Logger.log('Skipping lesson on ' + eventDate + ' (outside week range ' + weekStartStr + ' to ' + weekEndStr + ')');
        continue;
      }
      
      // Format time as HH:mm
      var eventTime = Utilities.formatDate(startDateObj, Session.getScriptTimeZone(), 'HH:mm');
      
      Logger.log('Processing lesson: ' + studentName + ' on ' + eventDate + ' at ' + eventTime + ' (status: ' + status + ')');
      
      // Initialize day if not exists
      if (!lessonsByDay[eventDate]) {
        lessonsByDay[eventDate] = {};
      }
      
      // Initialize time slot if not exists
      if (!lessonsByDay[eventDate][eventTime]) {
        lessonsByDay[eventDate][eventTime] = [];
      }
      
      // Add lesson to the time slot
      var isKidsLesson = false;
      if (isKidsLessonCol !== -1 && row[isKidsLessonCol]) {
        isKidsLesson = row[isKidsLessonCol] === '子' || row[isKidsLessonCol] === true;
      }
      
      lessonsByDay[eventDate][eventTime].push({
        eventID: row[eventIdCol],
        title: row[titleCol],
        studentName: studentName,
        status: status,
        startTime: startTime,
        endTime: endTime,
        isKidsLesson: isKidsLesson  // NEW FIELD
      });
      
      totalLessons++;
    }
    
    Logger.log('Processed ' + totalLessons + ' lessons for ' + Object.keys(lessonsByDay).length + ' days');
    
    // Check data size before returning
    var dataString = JSON.stringify(lessonsByDay);
    var dataSize = dataString.length;
    Logger.log('Data size: ' + dataSize + ' characters');
    Logger.log('Sample data: ' + dataString.substring(0, 200) + '...');
    
    // Check if data is too large for Google Apps Script
    if (dataSize > 50000) { // 50KB limit
      Logger.log('WARNING: Data size exceeds 50KB limit, truncating...');
      var truncatedData = {};
      var dayCount = 0;
      for (var date in lessonsByDay) {
        if (dayCount >= 3) break; // Limit to 3 days
        truncatedData[date] = {};
        var timeCount = 0;
        for (var time in lessonsByDay[date]) {
          if (timeCount >= 5) break; // Limit to 5 time slots per day
          truncatedData[date][time] = lessonsByDay[date][time].map(function(lesson) {
            return {
              studentName: lesson.studentName,
              status: lesson.status,
              startTime: lesson.startTime,
              endTime: lesson.endTime
            };
          });
          timeCount++;
        }
        dayCount++;
      }
      Logger.log('Truncated data size: ' + JSON.stringify(truncatedData).length + ' characters');
      return truncatedData;
    }
    
    Logger.log('Returning week lessonsByDay with ' + Object.keys(lessonsByDay).length + ' days');
    
    // Debug: Log the actual return value
    var returnValue = lessonsByDay;
    Logger.log('About to return: ' + JSON.stringify(returnValue).substring(0, 200) + '...');
    Logger.log('Return value type: ' + typeof returnValue);
    Logger.log('Return value keys: ' + Object.keys(returnValue));
    
    // Return the actual lesson data as JSON string
    Logger.log('Returning actual lesson data as JSON string');
    return JSON.stringify(lessonsByDay);
    
  } catch (error) {
    Logger.log('Error in getExistingLessonsFromSheet: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return {};
  }
}

function testFunction() {
  Logger.log('Test function called successfully');
  return { test: 'success', message: 'Google Apps Script is working' };
}

function debugGetExistingLessonsFromSheet() {
  try {
    Logger.log('=== DEBUG: getExistingLessonsFromSheet ===');
    
    // Test with today's date
    var today = new Date();
    var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    Logger.log('Testing with today\'s date: ' + todayStr);
    
    // Open spreadsheet
    var ss = SpreadsheetApp.openById(SS_ID);
    Logger.log('Spreadsheet opened successfully');
    
    // List all sheets
    var sheets = ss.getSheets();
    Logger.log('Available sheets: ' + sheets.map(s => s.getName()).join(', '));
    
           // First, specifically look for MonthlySchedule sheet
           var targetSheet = null;
           for (var i = 0; i < sheets.length; i++) {
             var sheetName = sheets[i].getName();
             if (sheetName === 'MonthlySchedule') {
               targetSheet = sheets[i];
               Logger.log('Found MonthlySchedule sheet: ' + sheetName);
               break;
             }
           }
           
           // If MonthlySchedule not found, try to find alternative sheets
           if (!targetSheet) {
             for (var i = 0; i < sheets.length; i++) {
               var sheetName = sheets[i].getName();
               if (sheetName.toLowerCase().includes('lesson') || 
                   sheetName.toLowerCase().includes('schedule') ||
                   sheetName.toLowerCase().includes('monthly')) {
                 targetSheet = sheets[i];
                 Logger.log('Found alternative sheet: ' + sheetName);
                 break;
               }
             }
           }
    
    if (!targetSheet) {
      Logger.log('No suitable sheet found, using first sheet: ' + sheets[0].getName());
      targetSheet = sheets[0];
    }
    
    // Get data from sheet
    var lastRow = targetSheet.getLastRow();
    var lastCol = targetSheet.getLastColumn();
    Logger.log('Sheet: ' + targetSheet.getName() + ', Rows: ' + lastRow + ', Cols: ' + lastCol);
    
    if (lastRow <= 1) {
      Logger.log('No data in sheet');
      return { error: 'No data in sheet' };
    }
    
    // Get headers
    var headers = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    // Get first few rows of data
    var sampleData = targetSheet.getRange(1, 1, Math.min(5, lastRow), lastCol).getValues();
    Logger.log('Sample data: ' + JSON.stringify(sampleData));
    
    return { 
      success: true, 
      sheetName: targetSheet.getName(),
      rows: lastRow,
      cols: lastCol,
      headers: headers,
      sampleData: sampleData
    };
    
  } catch (error) {
    Logger.log('Error in debugGetExistingLessonsFromSheet: ' + error.toString());
    return { error: error.toString() };
  }
}

function getAllStudentDataForCacheBatched(batchSize = 20) {
  Logger.log('=== getAllStudentDataForCacheBatched: Starting optimized data load ===');
  Logger.log('Batch size: ' + batchSize);
  
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var result = {};
    
    // Get all students
    var students = getStudents();
    var headers = students[0];
    var allStudentRows = students.slice(1);
    
    // Filter to only Active students for caching
    var statusIdx = headers.indexOf('Status');
    var studentRows = allStudentRows.filter(function(row) {
      var status = row[statusIdx];
      return status === 'Active';
    });
    
    Logger.log('Found ' + allStudentRows.length + ' total students, ' + studentRows.length + ' Active students to process');
    
    // Load ALL data once and build maps for efficient lookup
    Logger.log('📊 Loading all sheets data...');
    
    // Load all payments once
    var paymentsMap = {};
    try {
      var psh = ss.getSheetByName(PAYMENT_SHEET);
      if (psh) {
        var pdata = psh.getDataRange().getDisplayValues();
        var pheaders = pdata.shift();
        var pidIdx = pheaders.indexOf('Student ID');
        
        pdata.forEach(function(row) {
          var studentId = String(row[pidIdx]);
          if (!paymentsMap[studentId]) {
            paymentsMap[studentId] = [];
          }
          var obj = {};
          pheaders.forEach(function(h, j) { obj[h] = row[j]; });
          paymentsMap[studentId].push(obj);
        });
        Logger.log('✅ Loaded ' + Object.keys(paymentsMap).length + ' students with payments');
      }
    } catch (error) {
      Logger.log('❌ Error loading payments: ' + error.toString());
    }
    
    // Load all notes once
    var notesMap = {};
    try {
      var nsh = ss.getSheetByName(NOTES_SHEET);
      if (nsh) {
        var ndata = nsh.getDataRange().getDisplayValues();
        var nheaders = ndata.shift();
        var nidIdx = nheaders.indexOf('StudentID');
        
        ndata.forEach(function(row) {
          var studentId = String(row[nidIdx]);
          if (!notesMap[studentId]) {
            notesMap[studentId] = [];
          }
          var obj = {};
          nheaders.forEach(function(h, j) { obj[h] = row[j]; });
          notesMap[studentId].push(obj);
        });
        Logger.log('✅ Loaded ' + Object.keys(notesMap).length + ' students with notes');
      }
    } catch (error) {
      Logger.log('❌ Error loading notes: ' + error.toString());
    }
    
    // Load MonthlySchedule data for Latest Record
    var monthlyScheduleMap = {};
    try {
      var msh = ss.getSheetByName('MonthlySchedule');
      if (msh) {
        // Use getValues() to get Date objects instead of display strings
        var mdata = msh.getDataRange().getValues();
        var mheaders = mdata.shift();
        var studentNameIdx = mheaders.indexOf('StudentName');
        var statusIdx = mheaders.indexOf('Status');
        var startIdx = mheaders.indexOf('Start');
        var endIdx = mheaders.indexOf('End');
        var titleIdx = mheaders.indexOf('Title');
        
        mdata.forEach(function(row) {
          var studentName = row[studentNameIdx];
          if (studentName) {
            if (!monthlyScheduleMap[studentName]) {
              monthlyScheduleMap[studentName] = [];
            }
            // Format Start as DD/MM/YYYY HH:mm:ss for consistent parsing
            var startValue = row[startIdx];
            var startFormatted = '';
            if (startValue instanceof Date) {
              // Use Utilities.formatDate to format the date/time properly
              var day = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'dd');
              var month = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'MM');
              var year = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'yyyy');
              var hours = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'HH');
              var minutes = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'mm');
              var seconds = Utilities.formatDate(startValue, Session.getScriptTimeZone(), 'ss');
              startFormatted = day + '/' + month + '/' + year + ' ' + hours + ':' + minutes + ':' + seconds;
            } else if (startValue) {
              startFormatted = String(startValue);
            }
            
            var lessonObj = {
              studentName: studentName,
              status: row[statusIdx] || '',
              start: startFormatted,
              end: row[endIdx] || '',
              title: row[titleIdx] || ''
            };
            monthlyScheduleMap[studentName].push(lessonObj);
          }
        });
        Logger.log('✅ Loaded MonthlySchedule data for ' + Object.keys(monthlyScheduleMap).length + ' students');
      }
    } catch (error) {
      Logger.log('❌ Error loading MonthlySchedule: ' + error.toString());
    }
    
    Logger.log('📊 Building student data from maps...');
    
    // Process students in batches using the pre-loaded maps
    for (var batchStart = 0; batchStart < studentRows.length; batchStart += batchSize) {
      var batchEnd = Math.min(batchStart + batchSize, studentRows.length);
      var batch = studentRows.slice(batchStart, batchEnd);
      
      Logger.log('Processing batch ' + Math.floor(batchStart / batchSize) + 1 + ': students ' + (batchStart + 1) + ' to ' + batchEnd);
      
      // Process batch
      for (var i = 0; i < batch.length; i++) {
        var studentRow = batch[i];
        var studentId = String(studentRow[headers.indexOf('ID')]);
        var studentName = studentRow[headers.indexOf('Name')];
        
        if (!studentId || !studentName) {
          continue;
        }
        
        try {
          // Build student data using maps (much faster)
          var studentData = {
            student: getStudentById(studentId),
            payments: paymentsMap[studentId] || [],
            notes: notesMap[studentId] || [],
            LatestByMonth: {} // Will be populated with payment and lesson data
          };
          
          // Get student name for MonthlySchedule lookup
          var studentName = studentData.student ? (studentData.student.Name || studentData.student.name || '') : '';
          
          // Add latest record data (payment + lessons) for current and next month
          var now = new Date();
          var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMM yyyy'); // e.g., "Sep 2025"
          var nextMonth = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 1), Session.getScriptTimeZone(), 'MMM yyyy'); // e.g., "Oct 2025"
          
          // Process current month
          var currentMonthData = { Payment: '未', Lessons: [] };
          if (studentData.payments && studentData.payments.length > 0) {
            // Find payment for current month
            var currentMonthPayment = studentData.payments.find(function(p) {
              var paymentDate = new Date(p.Date || p.date);
              var paymentMonth = Utilities.formatDate(paymentDate, Session.getScriptTimeZone(), 'MMM yyyy');
              return paymentMonth === currentMonth;
            });
            if (currentMonthPayment) {
              currentMonthData.Payment = '済';
            }
          }
          
          // Add lessons for current month
          if (studentName && monthlyScheduleMap[studentName]) {
            var currentMonthLessons = monthlyScheduleMap[studentName].filter(function(lesson) {
              // Parse DD/MM/YYYY format correctly
              var dateParts = lesson.start.split(' ')[0].split('/');
              var day = parseInt(dateParts[0]);
              var month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
              var year = parseInt(dateParts[2]);
              var lessonDate = new Date(year, month, day);
              var lessonMonth = Utilities.formatDate(lessonDate, Session.getScriptTimeZone(), 'MMM yyyy');
              return lessonMonth === currentMonth;
            }).map(function(lesson) {
              // Transform MonthlySchedule format to expected lessonCard format
              // Parse DD/MM/YYYY format correctly
              var dateParts = lesson.start.split(' ')[0].split('/');
              var day = parseInt(dateParts[0]);
              var month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
              var year = parseInt(dateParts[2]);
              var lessonDate = new Date(year, month, day);
              var time = lesson.start.split(' ')[1] || '12:00:00'; // Extract time part
              return {
                day: day.toString().padStart(2, '0'),
                time: time.substring(0, 5), // Get HH:mm part
                status: lesson.status || 'scheduled'
              };
            });
            currentMonthData.Lessons = currentMonthLessons;
          }
          
          studentData.LatestByMonth[currentMonth] = currentMonthData;
          
          // Process next month
          var nextMonthData = { Payment: '未', Lessons: [] };
          if (studentName && monthlyScheduleMap[studentName]) {
            var nextMonthLessons = monthlyScheduleMap[studentName].filter(function(lesson) {
              // Parse DD/MM/YYYY format correctly
              var dateParts = lesson.start.split(' ')[0].split('/');
              var day = parseInt(dateParts[0]);
              var month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
              var year = parseInt(dateParts[2]);
              var lessonDate = new Date(year, month, day);
              var lessonMonth = Utilities.formatDate(lessonDate, Session.getScriptTimeZone(), 'MMM yyyy');
              return lessonMonth === nextMonth;
            }).map(function(lesson) {
              // Transform MonthlySchedule format to expected lessonCard format
              // Parse DD/MM/YYYY format correctly
              var dateParts = lesson.start.split(' ')[0].split('/');
              var day = parseInt(dateParts[0]);
              var month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
              var year = parseInt(dateParts[2]);
              var lessonDate = new Date(year, month, day);
              var time = lesson.start.split(' ')[1] || '12:00:00'; // Extract time part
              return {
                day: day.toString().padStart(2, '0'),
                time: time.substring(0, 5), // Get HH:mm part
                status: lesson.status || 'scheduled'
              };
            });
            nextMonthData.Lessons = nextMonthLessons;
          }
          
          studentData.LatestByMonth[nextMonth] = nextMonthData;
          
          
          if (studentData.student) {
            result[studentId] = studentData;
          }
        } catch (error) {
          Logger.log('❌ Error processing student ' + studentName + ': ' + error.toString());
        }
      }
      
      // Progress update
      var progress = Math.round((batchEnd / studentRows.length) * 100);
      Logger.log('Progress: ' + progress + '% (' + batchEnd + '/' + studentRows.length + ' students processed)');
      
      // Delay between batches to prevent server overload
      if (batchEnd < studentRows.length) {
        Utilities.sleep(100); // Reduced delay since we're not loading sheets repeatedly
      }
    }
    
    Logger.log('=== Optimized data load complete ===');
    Logger.log('Successfully loaded data for ' + Object.keys(result).length + ' students');
    
    return result;
    
  } catch (error) {
    Logger.log('❌ Fatal error in getAllStudentDataForCacheBatched: ' + error.toString());
    return {};
  }
}

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache statistics
 */
function getCacheStatistics() {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var students = getStudents();
    var studentCount = students.length - 1; // Exclude header row
    
    var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
    var paymentCount = paymentSheet ? paymentSheet.getLastRow() - 1 : 0;
    
    var notesSheet = ss.getSheetByName(NOTES_SHEET);
    var notesCount = notesSheet ? notesSheet.getLastRow() - 1 : 0;
    
    var lessonSheet = ss.getSheetByName(LESSON_SHEET);
    var lessonCount = lessonSheet ? lessonSheet.getLastRow() - 1 : 0;
    
    return {
      students: studentCount,
      payments: paymentCount,
      notes: notesCount,
      lessons: lessonCount,
      timestamp: new Date().toISOString(),
      estimatedCacheSize: (studentCount * 2) + 'KB' // Rough estimate
    };
    
  } catch (error) {
    Logger.log('❌ Error getting cache statistics: ' + error.toString());
    return { error: error.toString() };
  }
}