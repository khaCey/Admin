# Payment Data Flow - Transaction ID Issue

## Data Source
**Google Sheets Tab: `Payment`** (defined as `PAYMENT_SHEET` in Code.js line 4)

## Complete Data Flow Path

### 1. **Backend Retrieval** (Code.js)
   - **Function**: `getStudentDetails(id)` (line 441)
   - **Sheet**: `Payment` tab in Google Sheets
   - **Method**: `getDisplayValues()` - gets all data as displayed strings
   - **Process**:
     ```javascript
     var pdata = psh.getDataRange().getDisplayValues();  // Get all rows
     var pheaders = pdata.shift();  // First row = headers
     // Filter rows where 'Student ID' matches the requested student ID
     // Create objects with headers as keys
     ```

### 2. **Data Structure Created**
   Each payment object is created with:
   ```javascript
   {
     'Transaction ID': value,  // From column with header "Transaction ID"
     'Student ID': value,
     'Date': value,
     'Year': value,
     'Month': value,
     'Total': value,
     'Amount': value,
     'Method': value,
     'Staff': value,
     // ... other columns
   }
   ```

### 3. **Backend Response**
   Returns object:
   ```javascript
   {
     student: {...},
     payments: [payment1, payment2, ...],  // Array of payment objects
     notes: [...],
     latestByMonth: {...}
   }
   ```

### 4. **Frontend Reception** (Index.html)
   - **Called via**: `google.script.run.withSuccessHandler(...).getStudentDetails(id)`
   - **Location**: Line 7663 in Index.html
   - **Handler**: Receives the result object

### 5. **Data Normalization** (Index.html)
   - **Function**: `normaliseForModal(baseResp, latest)` (line 7328)
   - **Extracts**: `baseResp.payments` array
   - **Processes**: Through `normalisePayments(payments)` (line 7349)
   
   **normalisePayments function** (line 7219):
   - Takes raw payment array from backend
   - Maps each payment to normalized structure
   - **Should preserve**: `'Transaction ID'` field
   - **Also creates**: `transactionId` (camelCase version)

### 6. **Student Object Assignment** (Index.html)
   - **Function**: `loadStudent(model)` (line 7354)
   - **Assigns**: `student = model` (which includes normalized payments)
   - **Stores**: `student.payments` array

### 7. **Display Rendering** (Index.html)
   - **Function**: `renderPaymentsTable()` (line 7385)
   - **Reads**: `student.payments` array
   - **Extracts Transaction ID**: 
     ```javascript
     const txn = p.transactionId || p['Transaction ID'] || ...
     ```
   - **Displays**: In table cell `<td>${txn}</td>`

## Potential Issues

1. **Header Name Mismatch**: 
   - Sheet column might be named differently (e.g., "TransactionID", "transaction_id")
   - Check: Apps Script logs will show actual headers

2. **Empty Values**: 
   - Transaction ID column exists but values are empty
   - Check: Apps Script logs show "EMPTY" if value is missing

3. **Normalization Loss**: 
   - Transaction ID might be lost during `normalisePayments`
   - Check: Browser console shows payment object structure

4. **Column Index Mismatch**: 
   - Headers array and data rows might be misaligned
   - Fixed: Now using original headers array for mapping

## Debugging Steps

1. **Check Apps Script Logs** (Extensions > Apps Script > View > Executions):
   - Look for: "📋 Payment sheet - All headers"
   - Look for: "💰 Payment #X for student Y"
   - Look for: "Transaction ID value at index X"

2. **Check Browser Console** (F12):
   - Look for: "🔍 Debug - First payment object"
   - Look for: "🔍 Debug - Transaction ID check"
   - Look for: "⚠️ Transaction ID is empty for payment"

3. **Verify Sheet Structure**:
   - Open Google Sheets
   - Go to "Payment" tab
   - Check if column header is exactly "Transaction ID" (with space)
   - Check if Transaction ID values exist in the rows

