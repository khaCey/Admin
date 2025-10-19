// ─── CONFIGURATION (from user's source) ────────────────────────────────────────
var SS_ID               = '1upKC-iNWs7HIeKiVVAegve5O5WbNebbjMlveMcvnuow';
var STUDENT_SHEET       = 'Students';
var PAYMENT_SHEET       = 'PaymentLogs';
var NOTES_SHEET         = 'Notes';
var LESSON_SHEET        = 'Lessons';
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
  }
};
// ─── END CONFIGURATION ─────────────────────────────────────────────────────────

function doGet(){return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('Student Modal — V5');}

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
    Logger.log('[getAllPayments] Start');
    var sh = SpreadsheetApp.openById(SS_ID).getSheetByName('Payment');
    Logger.log('[getAllPayments] Sheet loaded');
    var data = sh.getDataRange().getValues();
    Logger.log('[getAllPayments] Data loaded, rows: ' + data.length);
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
      var pidIdx = pheaders.indexOf('Student ID');
      
      pdata.forEach(function(r){
        if (String(r[pidIdx]) === String(id)) {
          var obj = {};
          pheaders.forEach(function(h,j){ obj[h] = r[j]; });
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
      var latestRecordData = getLatestRecordData(studentName);
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
      data    = sh.getDataRange().getValues(),
      headers = data[0],
      idx     = headers.indexOf('Transaction ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(pay['Transaction ID'])) {
      headers.forEach(function(h,j){
        if (h !== 'Transaction ID') {
          sh.getRange(i+1,j+1).setValue(pay[h]||'');
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

  // Flat Pronunciation
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

  Logger.log('📋 Headers: %s', JSON.stringify(heads));

  // Find column indices
  const idCol    = heads.indexOf('ID');
  const typeCol  = heads.indexOf('Payment');  // Updated from 'Type' to 'Payment Type'
  const groupCol = heads.indexOf('Group');
  const sizeCol  = heads.indexOf('人数');
  Logger.log('IndexOf -> ID:%d, Payment:%d, Group:%d, 人数:%d', idCol, typeCol, groupCol, sizeCol);

  // Locate the student row
  let rawFeeType, rawLessonType, groupSize;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][idCol]) === String(studentID)) {
      rawFeeType      = values[i][typeCol];
      rawLessonType   = values[i][groupCol];
      groupSize       = Number(values[i][sizeCol]) || 0;
      Logger.log('Found row %d → Payment:%s, Group:%s, 人数:%d', i+2, rawFeeType, rawLessonType, groupSize);
      break;
    }
  }
  if (!rawFeeType) {
    throw new Error('Student ID ' + studentID + ' not found in Students sheet.');
  }

  // Normalize to match feeTable keys:
  //   OLD  → OLD
  //   NEO  → Neo
  let feeTypeKey;
  const norm = rawFeeType ? rawFeeType.trim().toLowerCase() : '';
  if (norm === 'old') feeTypeKey = 'OLD';
  else if (norm === 'neo') feeTypeKey = 'Neo';
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
  Logger.log('💰 insertPayment called with: %s', JSON.stringify(pay));

  var ss = SpreadsheetApp.openById(SS_ID);
  var sh = ss.getSheetByName('Payment');
  if (!sh) throw new Error('Sheet "Payment" not found.');

  // 1) Pull headers from the first row
  var headers = sh.getDataRange().getValues()[0];
  Logger.log('📋 Payment sheet headers: %s', JSON.stringify(headers));

  // 2) Generate Transaction ID if not provided
  if (!pay['Transaction ID'] || pay['Transaction ID'] === '') {
    var timestamp = new Date().getTime();
    var randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    pay['Transaction ID'] = 'TXN' + timestamp + randomSuffix;
    Logger.log('💰 Generated Transaction ID: ' + pay['Transaction ID']);
  }

  // 3) Build the new row, coercing Amount & Total into numbers
  var newRow = headers.map(function(h) {
    switch (h) {
      case 'Amount':
        // ensure numeric
        var amount = Number(pay[h]) || 0;
        Logger.log('💰 Amount field "%s": %s -> %s', h, pay[h], amount);
        return amount;
      case 'Total':
        // ensure numeric
        var total = Number(pay[h]) || 0;
        Logger.log('💰 Total field "%s": %s -> %s', h, pay[h], total);
        return total;
      default:
        // leave everything else as-is
        var value = pay[h] || '';
        Logger.log('💰 Field "%s": %s', h, value);
        return value;
    }
  });

  Logger.log('💾 Appending payment row (with numeric Amount/Total): %s', JSON.stringify(newRow));
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
    // Normalize "MMMM yyyy"
    var parts        = monthText.split('-');
    var year         = parseInt(parts[0], 10);
    var monthNum     = parseInt(parts[1], 10) - 1;
    var tz           = ss.getSpreadsheetTimeZone();
    var formattedMonth = Utilities.formatDate(new Date(year, monthNum, 1), tz, 'MMMM yyyy');

    for (var i = 1; i < lessonData.length; i++) {
      var row = lessonData[i];
      if (String(row[sidIdx]) === String(pay['Student ID'])) {
        var cell = row[monIdx];
        var match = (cell instanceof Date)
          ? (cell.getFullYear() === year && cell.getMonth() === monthNum)
          : (String(cell).trim() === formattedMonth || String(cell).trim() === monthText);
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
  var titleIdx = headers.indexOf('Title');
  
  Logger.log('Column indices - StudentName: ' + studentNameIdx + ', Status: ' + statusIdx + ', Start: ' + startIdx);
  
  var studentEvents = [];
  
  Logger.log('Searching for student: "' + studentName + '" in month: "' + monthText + '"');
  
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
          
          studentEvents.push({
            day: day,
            time: time,
            status: status
          });
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
        }
        
        // Add lesson to the time slot
        lessonsByDay[eventDate][eventTime].push({
          title: title,
          studentName: title, // Use title as student name for now
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
    } else {
      // Determine status based on event color (only if not a placeholder)
      var color = event.getColor();
      if (color === '8' || color === '9') { // Graphite, Lavender
        status = 'cancelled';
      } else if (color === '5') { // Banana
        status = 'rescheduled';
      } else if (color === '11') { // Orange
        status = 'unbooked';
      }
    }
    
    // Extract the part before the first parenthesis
    var namePart = title.split('(')[0];
    // Remove all occurrences of '子' (anywhere) BEFORE splitting
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
    for (var i = 0; i < names.length; i++) {
      var parts = names[i].split(/\s+/);
      if (parts.length > 1) {
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          status,
          names[i]
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
          fullName.trim()
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
  
  // Write headers
  var headers = ['EventID', 'Title', 'Start', 'End', 'Status', 'StudentName'];
  cacheSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Use getAllEventsForMonth function to fetch ALL events (no filtering)
  var events = getAllEventsForMonth(monthStr);
  Logger.log('Retrieved ' + events.length + ' events from calendar for ' + monthStr);
  
  // Process events using the extracted function
  var validRows = processEventsForMonth(events);
  
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
  
  // Set A1 to the month for reference
  cacheSheet.getRange('A1').setValue(yyyymm);
  
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
    manualSheet.appendRow(['EventID', 'Title', 'Start', 'End', 'StudentName']);
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
    // Extract the part before the first parenthesis
    var namePart = title.split('(')[0];
    namePart = namePart.replace(/子/g, '');
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
          names[i]
        ]);
      } else {
        var fullName = parts[0] + (lastName ? ' ' + lastName : '');
        validRows.push([
          event.getId(),
          title,
          event.getStartTime(),
          event.getEndTime(),
          fullName.trim()
        ]);
      }
    }
  });
  if (validRows.length > 0) {
    manualSheet.getRange(manualSheet.getLastRow() + 1, 1, validRows.length, 5).setValues(validRows);
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

function getUnpaidStudentsThisMonth() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  var studentsSheet = ss.getSheetByName('Students');

  var today = new Date();
  var tz = Session.getScriptTimeZone();
  var currentMonth = Utilities.formatDate(today, tz, 'MMMM');
  var currentYear = Utilities.formatDate(today, tz, 'yyyy');

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
    var eventMonth = Utilities.formatDate(eventDate, tz, 'MMMM');
    var eventYear = Utilities.formatDate(eventDate, tz, 'yyyy');
    if (eventMonth === currentMonth && eventYear === currentYear) {
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
    if (row[idxPayMonth] === currentMonth && row[idxPayYear] === currentYear) {
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
      if (monthCell && monthCell.toString().includes(yearStr)) {
        months.push(monthCell.toString());
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

function getLatestRecordData(studentName) {
  // Get latest record data for the Latest Record component
  Logger.log('=== getLatestRecordData called ===');
  Logger.log('Student name: ' + studentName);
  
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
  
  // Ensure cache exists for both months
  var ss = SpreadsheetApp.openById(SS_ID);
  var cacheSheet = ss.getSheetByName('MonthlySchedule');
  if (!cacheSheet) {
    Logger.log('MonthlySchedule sheet not found, creating cache for current month...');
    cacheMonthlyEvents(currentMonth);
  }
  
  // Get events for both months
  var currentMonthEvents = getStudentEventsForMonth(studentName, currentMonth);
  var nextMonthEvents = getStudentEventsForMonth(studentName, nextMonth);
  
  Logger.log('Current month events: ' + currentMonthEvents.length);
  Logger.log('Next month events: ' + nextMonthEvents.length);
  
  // Get payment information for both months
  var currentMonthPaymentInfo = getPaymentInfoForMonth(studentName, currentMonth);
  var nextMonthPaymentInfo = getPaymentInfoForMonth(studentName, nextMonth);
  
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
  
  // Add current month data with unscheduled lessons
  if (currentMonthEvents.length > 0 || currentMonthPaymentInfo !== null) {
    var currentMonthData = {
      Payment: currentMonthPaymentInfo ? currentMonthPaymentInfo.status : '未',
      lessons: currentMonthEvents
    };
    
    // Add unscheduled lessons if payment info exists and there are more paid lessons than scheduled
    if (currentMonthPaymentInfo && currentMonthPaymentInfo.lessons > currentMonthEvents.length) {
      var unscheduledCount = currentMonthPaymentInfo.lessons - currentMonthEvents.length;
      Logger.log('Adding ' + unscheduledCount + ' unscheduled lessons for ' + studentName + ' in ' + currentMonth);
      
      for (var i = 0; i < unscheduledCount; i++) {
        currentMonthData.lessons.push({
          day: '--',
          time: '--',
          status: 'unscheduled'
        });
      }
    }
    
    latestByMonth[currentMonthShort] = currentMonthData;
  } else {
    // Even if no events found, show payment status and unscheduled lessons if payment exists
    if (currentMonthPaymentInfo !== null) {
      var currentMonthData = {
        Payment: currentMonthPaymentInfo.status,
        lessons: []
      };
      
      // If payment exists but no events, all lessons are unscheduled
      if (currentMonthPaymentInfo.lessons > 0) {
        Logger.log('No events found but payment exists. Adding ' + currentMonthPaymentInfo.lessons + ' unscheduled lessons for ' + studentName + ' in ' + currentMonth);
        
        for (var i = 0; i < currentMonthPaymentInfo.lessons; i++) {
          currentMonthData.lessons.push({
            day: '--',
            time: '--',
            status: 'unscheduled'
          });
        }
      }
      
      latestByMonth[currentMonthShort] = currentMonthData;
    }
  }
  
  // Add next month data with unscheduled lessons
  if (nextMonthEvents.length > 0 || nextMonthPaymentInfo !== null) {
    var nextMonthData = {
      Payment: nextMonthPaymentInfo ? nextMonthPaymentInfo.status : '未',
      lessons: nextMonthEvents
    };
    
    // Add unscheduled lessons if payment info exists and there are more paid lessons than scheduled
    if (nextMonthPaymentInfo && nextMonthPaymentInfo.lessons > nextMonthEvents.length) {
      var unscheduledCount = nextMonthPaymentInfo.lessons - nextMonthEvents.length;
      Logger.log('Adding ' + unscheduledCount + ' unscheduled lessons for ' + studentName + ' in ' + nextMonth);
      
      for (var i = 0; i < unscheduledCount; i++) {
        nextMonthData.lessons.push({
          day: '--',
          time: '--',
          status: 'unscheduled'
        });
      }
    }
    
    latestByMonth[nextMonthShort] = nextMonthData;
  } else {
    // Even if no events found, show payment status and unscheduled lessons if payment exists
    if (nextMonthPaymentInfo !== null) {
      var nextMonthData = {
        Payment: nextMonthPaymentInfo.status,
        lessons: []
      };
      
      // If payment exists but no events, all lessons are unscheduled
      if (nextMonthPaymentInfo.lessons > 0) {
        Logger.log('No events found but payment exists. Adding ' + nextMonthPaymentInfo.lessons + ' unscheduled lessons for ' + studentName + ' in ' + nextMonth);
        
        for (var i = 0; i < nextMonthPaymentInfo.lessons; i++) {
          nextMonthData.lessons.push({
            day: '--',
            time: '--',
            status: 'unscheduled'
          });
        }
      }
      
      latestByMonth[nextMonthShort] = nextMonthData;
    }
  }
  
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
  
  return {
    latestByMonth: latestByMonth
  };
}

function getPaymentInfoForMonth(studentName, monthText) {
  // Get payment information for a student in a specific month
  // Simply check if there are any payment logs for this student in this month
  Logger.log('=== getPaymentInfoForMonth called ===');
  Logger.log('Student name: ' + studentName);
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
  
  var studentNameIdx = headers.indexOf('Student Name');
  var monthIdx = headers.indexOf('Month');
  var yearIdx = headers.indexOf('Year');
  var lessonsIdx = headers.indexOf('Lessons');
  var amountIdx = headers.indexOf('Amount');
  var totalIdx = headers.indexOf('Total');
  
  Logger.log('Column indices - StudentName: ' + studentNameIdx + ', Month: ' + monthIdx + ', Year: ' + yearIdx);
  
  if (studentNameIdx === -1 || monthIdx === -1) {
    Logger.log('Required columns not found in Payment sheet');
    return null;
  }
  
  // Parse month text to get month name and year
  var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var year, monthName;
  
  if (/^\d{4}-\d{2}$/.test(monthText)) { // '2025-05'
    var parts = monthText.split('-');
    year = parts[0];
    monthName = monthNames[parseInt(parts[1]) - 1];
  } else if (/^[A-Za-z]+ \d{4}$/.test(monthText)) { // 'May 2025'
    var parts = monthText.trim().split(' ');
    monthName = parts[0];
    year = parts[1];
  } else {
    Logger.log('Invalid monthText format: ' + monthText);
    return null;
  }
  
  Logger.log('Looking for payment logs: student=' + studentName + ', month=' + monthName + ', year=' + year);
  
  var totalLessons = 0;
  var totalAmount = 0;
  var foundAnyPayment = false;
  
  // Check all payment logs for this student in this month
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowStudentName = String(row[studentNameIdx] || '').trim();
    var rowMonth = String(row[monthIdx] || '').trim();
    var rowYear = String(row[yearIdx] || '').trim();
    
    Logger.log('Row ' + i + ' - Student: "' + rowStudentName + '", Month: "' + rowMonth + '", Year: "' + rowYear + '"');
    
    if (rowStudentName === studentName && rowMonth === monthName && rowYear === year) {
      foundAnyPayment = true;
      var lessons = parseInt(row[lessonsIdx]) || 0;
      var amount = parseFloat(row[amountIdx]) || 0;
      
      totalLessons += lessons;
      totalAmount += amount;
      
      Logger.log('Found payment log: lessons=' + lessons + ', amount=' + amount);
    }
  }
  
  if (foundAnyPayment) {
    Logger.log('Payment found for ' + studentName + ' in ' + monthText + ': lessons=' + totalLessons + ', amount=' + totalAmount);
    return {
      status: '済', // Mark as paid if any payment logs exist
      lessons: totalLessons,
      amount: totalAmount,
      total: totalAmount
    };
  }
  
  Logger.log('No payment logs found for ' + studentName + ' in ' + monthText);
  return null; // No payment logs found
}

function getPaymentStatusForMonth(studentName, monthText) {
  // Check payment status for a student in a specific month
  // Simply check if there are any payment logs for this student in this month
  var ss = SpreadsheetApp.openById(SS_ID);
  var paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
  if (!paymentSheet) return null;
  
  var data = paymentSheet.getDataRange().getValues();
  var headers = data[0];
  var studentNameIdx = headers.indexOf('Student Name');
  var monthIdx = headers.indexOf('Month');
  var yearIdx = headers.indexOf('Year');
  
  if (studentNameIdx === -1 || monthIdx === -1) return null;
  
  // Parse month text to get month name and year
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
    return null;
  }
  
  // Look for any payment logs for this student in this month
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowStudentName = String(row[studentNameIdx] || '').trim();
    var rowMonth = String(row[monthIdx] || '').trim();
    var rowYear = String(row[yearIdx] || '').trim();
    
    if (rowStudentName === studentName && 
        (rowMonth === monthName || rowMonth === monthText) && 
        rowYear === year) {
      // If any payment log exists for this student in this month, mark as paid
      return '済';
    }
  }
  
  return null; // No payment logs found
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

function getLatestRecordForStudent(studentName) {
  // API endpoint to get latest record data for the Latest Record component
  Logger.log('=== getLatestRecordForStudent called ===');
  Logger.log('Student name: ' + studentName);
  
  try {
    var data = getLatestRecordData(studentName);
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

  // Get headers and data
  var headers = sh.getDataRange().getValues()[0];
  var data = sh.getDataRange().getValues();
  var txnIdIndex = headers.indexOf('Transaction ID');
  
  if (txnIdIndex === -1) {
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
    
    // Update event title to show cancelled status
    var originalTitle = event.getTitle();
    var cancelledTitle = '[CANCELLED] ' + originalTitle;
    event.setTitle(cancelledTitle);
    
    // Add cancellation note to description
    var originalDescription = event.getDescription() || '';
    var cancellationNote = '\n\n--- CANCELLATION ---\nReason: ' + reason + '\nCancelled by: ' + getCurrentStaffName() + '\nDate: ' + new Date().toLocaleString();
    event.setDescription(originalDescription + cancellationNote);
    
    // Log the action
    logLessonAction(studentId, eventId, 'cancel', null, null, reason);
    
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
    var event = calendar.getEventById(eventId);
    
    if (!event) {
      Logger.log('Event not found: ' + eventId);
      return { success: false, error: 'Event not found' };
    }
    
    var oldStartTime = event.getStartTime();
    var oldEndTime = event.getEndTime();
    var duration = oldEndTime.getTime() - oldStartTime.getTime();
    
    // Create new start and end times
    var newStartTime = new Date(newDateTime);
    var newEndTime = new Date(newStartTime.getTime() + duration);
    
    // Update the event
    event.setTime(newStartTime, newEndTime);
    
    // Add reschedule note to description
    var originalDescription = event.getDescription() || '';
    var rescheduleNote = '\n\n--- RESCHEDULED ---\nOld Time: ' + oldStartTime.toLocaleString() + '\nNew Time: ' + newStartTime.toLocaleString() + '\nReason: ' + reason + '\nRescheduled by: ' + getCurrentStaffName() + '\nDate: ' + new Date().toLocaleString();
    event.setDescription(originalDescription + rescheduleNote);
    
    // Log the action
    logLessonAction(studentId, eventId, 'reschedule', oldStartTime.toISOString(), newStartTime.toISOString(), reason);
    
    Logger.log('Lesson rescheduled successfully: ' + eventId);
    return { success: true, message: 'Lesson rescheduled successfully' };
    
  } catch (error) {
    Logger.log('Error rescheduling lesson: ' + error.toString());
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
    
    // Log the action before deletion
    logLessonAction(studentId, eventId, 'remove', event.getStartTime().toISOString(), null, reason);
    
    // Delete the event
    event.deleteEvent();
    
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
function bookLesson(studentId, dateTime, duration, lessonType, notes) {
  try {
    Logger.log('Booking lesson for student: ' + studentId);
    
    // Get student details
    var student = getStudentById(studentId);
    if (!student) {
      Logger.log('Student not found: ' + studentId);
      return { success: false, error: 'Student not found' };
    }
    
    var calendar = CalendarApp.getCalendarById(LESSON_CALENDAR_ID);
    
    // Create start and end times
    var startTime = new Date(dateTime);
    var endTime = new Date(startTime.getTime() + (50 * 60 * 1000)); // Fixed 50 minutes duration
    
    // Create event title
    var studentName = student.Name || student.name || 'Unknown Student';
    var title = studentName + ' (' + lessonType + ')';
    
    // Create event description
    var description = 'Booked by: ' + getCurrentStaffName() + '\n';
    description += 'Booked on: ' + new Date().toLocaleString() + '\n';
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
    
    // Check for conflicts in the time range
    var eventDate = startTime.toISOString().split('T')[0];
    var eventTime = startTime.toTimeString().split(' ')[0].substring(0, 5);
    
    if (existingLessons[eventDate] && existingLessons[eventDate][eventTime]) {
      var existingLesson = existingLessons[eventDate][eventTime];
      Logger.log('Found existing lesson: ' + existingLesson.title);
      
      return {
        hasConflict: true,
        reason: 'Time slot already has a lesson: ' + existingLesson.title
      };
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
    
    Logger.log('Column indices - Start: ' + startTimeCol + ', End: ' + endTimeCol + ', StudentName: ' + studentNameCol + ', Status: ' + statusCol);
    
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
      lessonsByDay[eventDate][eventTime].push({
        title: studentName,
        studentName: studentName,
        status: status,
        startTime: startTime,
        endTime: endTime
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
        var mdata = msh.getDataRange().getDisplayValues();
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
            var lessonObj = {
              studentName: studentName,
              status: row[statusIdx] || '',
              start: row[startIdx] || '',
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