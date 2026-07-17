// Google Apps Script for receiving lead form submissions into a Google Sheet.
//
// Setup (one time):
// 1. Create a new Google Sheet (or open an existing one).
// 2. Extensions -> Apps Script -> delete any code there and paste this file's code.
// 3. Click Deploy -> New deployment -> Type: "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Click Deploy, authorize, and copy the Web app URL
//    (looks like: https://script.google.com/macros/s/XXXX/exec).
// 5. Paste that URL into config.json -> "google_sheet_webhook_url".
// 6. Restart the local server (node server.js).

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Received At', 'Name', 'Email', 'Business Type', 'Consent', 'UTM Source', 'Form Type', 'Resource']);
  }

  sheet.appendRow([
    data.received_at || new Date().toISOString(),
    data.name || '',
    data.email || '',
    data.business_type || '',
    data.consent || '',
    data.utm_source || '',
    data.form_type || '',
    data.resource || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
