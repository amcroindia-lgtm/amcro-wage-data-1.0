/**
 * AMCRO INDIA WMS — Supervisor Attendance backend
 *
 * SETUP:
 * 1. Create a NEW Google Sheet (any name, e.g. "AMCRO Attendance").
 * 2. Extensions -> Apps Script. Delete any starter code, paste this whole file in.
 * 3. Click Deploy -> New deployment -> type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web app URL it gives you (ends in /exec).
 * 5. Paste that URL into ATTENDANCE_WEBHOOK_URL in src/App.jsx.
 * 6. First time anyone marks attendance, this script will:
 *    - auto-create a sheet tab called "Attendance" with the header row
 *    - auto-create a Drive folder called "AMCRO Attendance Photos" to store site photos
 * You do not need to create the tab or folder yourself.
 */

var SHEET_NAME = "Attendance";
var PHOTO_FOLDER_NAME = "AMCRO Attendance Photos";
var HEADERS = ["Name", "Site Name", "On Duty Timing", "Picture at Start (PAS)", "Off Duty Timing", "Picture at End (PAE)", "Date"];

// Normalizes text before comparing, so "Ramesh " vs "ramesh" vs "Ramesh" all match.
function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getPhotoFolder() {
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

// Accepts a data URL ("data:image/jpeg;base64,...") or raw base64, saves it to Drive,
// makes it link-viewable, and returns a URL that opens the image in the browser.
function savePhotoAndGetLink(base64Data, fileNamePrefix) {
  if (!base64Data) return "";
  var match = String(base64Data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  var mimeType = match ? match[1] : "image/jpeg";
  var pureBase64 = match ? match[2] : base64Data;
  var ext = (mimeType.split("/")[1] || "jpg").split("+")[0];
  var bytes = Utilities.base64Decode(pureBase64);
  var blob = Utilities.newBlob(bytes, mimeType, fileNamePrefix + "." + ext);
  var folder = getPhotoFolder();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function todayDateStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function nowTimeStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a");
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = getSheet();

  if (data.action === "markOnDuty") return jsonOut(markOnDuty(sheet, data));
  if (data.action === "markOffDuty") return jsonOut(markOffDuty(sheet, data));

  return jsonOut({ ok: false, error: "Unknown action" });
}

function markOnDuty(sheet, data) {
  var name = String(data.name || "").trim();
  var siteName = String(data.siteName || "").trim();
  if (!name || !siteName) return { ok: false, error: "Name and Site Name are required." };

  var today = todayDateStr();
  var values = sheet.getDataRange().getValues();

  // Block duplicate on-duty for the same person+site+day (row is "open" if Off Duty Timing is blank)
  for (var i = 1; i < values.length; i++) {
    if (norm(values[i][0]) === norm(name) && norm(values[i][1]) === norm(siteName) && values[i][6] === today && !values[i][4]) {
      return { ok: false, error: "You already marked On Duty today. Please mark Off Duty instead." };
    }
  }

  var photoLink = savePhotoAndGetLink(data.photo, "PAS_" + name.replace(/[^a-zA-Z0-9]/g, "_") + "_" + today);
  sheet.appendRow([name, siteName, nowTimeStr(), photoLink, "", "", today]);
  return { ok: true, onDutyTime: nowTimeStr() };
}

function markOffDuty(sheet, data) {
  var name = String(data.name || "").trim();
  var siteName = String(data.siteName || "").trim();
  if (!name || !siteName) return { ok: false, error: "Name and Site Name are required." };

  var today = todayDateStr();
  var values = sheet.getDataRange().getValues();
  var rowNum = -1;
  for (var i = values.length - 1; i >= 1; i--) {
    if (norm(values[i][0]) === norm(name) && norm(values[i][1]) === norm(siteName) && values[i][6] === today && !values[i][4]) {
      rowNum = i + 1; // 1-indexed sheet row
      break;
    }
  }
  if (rowNum === -1) return { ok: false, error: "No On Duty record found for today. Please mark On Duty first." };

  var photoLink = savePhotoAndGetLink(data.photo, "PAE_" + name.replace(/[^a-zA-Z0-9]/g, "_") + "_" + today);
  var offTime = nowTimeStr();
  sheet.getRange(rowNum, 5).setValue(offTime); // column E
  sheet.getRange(rowNum, 6).setValue(photoLink); // column F
  return { ok: true, offDutyTime: offTime };
}

function doGet(e) {
  var action = e.parameter.action;
  var sheet = getSheet();

  if (action === "getStatus") {
    var name = String(e.parameter.name || "").trim();
    var siteName = String(e.parameter.siteName || "").trim();
    var today = todayDateStr();
    var values = sheet.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) {
      if (norm(values[i][0]) === norm(name) && norm(values[i][1]) === norm(siteName) && values[i][6] === today) {
        var offDuty = values[i][4];
        return jsonOut({
          ok: true,
          status: offDuty ? "completed" : "onduty",
          onDutyTime: values[i][2] || null,
          offDutyTime: offDuty || null,
        });
      }
    }
    return jsonOut({ ok: true, status: "none" });
  }

  return jsonOut({ ok: false, error: "Unknown action" });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
