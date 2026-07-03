var ATT_SHEET = "Attendance";

function getAttSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ATT_SHEET);
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === "checkStatus") {
    var sheet = getAttSheet();
    var supId = e.parameter.supId.toUpperCase().trim();
    var date  = e.parameter.date;
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      var rowId = String(values[i][0]).toUpperCase().trim();
      if (rowId !== supId) continue;
      var onDutyDate = extractDate(values[i][3]);
      if (onDutyDate !== date) continue;
      var offDuty = String(values[i][5]).trim();
      return jsonOut({ ok: true, found: true, hasOffDuty: offDuty !== "" && offDuty !== "0" });
    }
    return jsonOut({ ok: true, found: false });
  }

  return jsonOut({ ok: false, error: "Unknown action" });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = getAttSheet();
  var folder = getOrCreateFolder("AMCRO Site Photos");

  if (data.action === "onDuty") {
    var photoLink = data.photoBase64 ? uploadPhoto(folder, data.photoBase64, data.supId + "_ON_" + data.date) : "";
    var now = new Date();
    var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([
      data.supId.toUpperCase(), data.name, data.siteName,
      timeStr, photoLink, "", "", data.date  // column H = plain yyyy-MM-dd date
    ]);
    return jsonOut({ ok: true });
  }

  if (data.action === "offDuty") {
    var values = sheet.getDataRange().getValues();
    var supId = data.supId.toUpperCase().trim();
    for (var i = values.length - 1; i >= 1; i--) {
      var rowId = String(values[i][0]).toUpperCase().trim();
      if (rowId !== supId) continue;
      var rowDate = String(values[i][7]).trim(); // column H = plain date
      if (rowDate !== data.date) continue;
      var photoLink2 = data.photoBase64 ? uploadPhoto(folder, data.photoBase64, data.supId + "_OFF_" + data.date) : "";
      var now2 = new Date();
      var timeStr2 = Utilities.formatDate(now2, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
      sheet.getRange(i + 1, 6).setValue(timeStr2);
      sheet.getRange(i + 1, 7).setValue(photoLink2);
      return jsonOut({ ok: true });
    }
    return jsonOut({ ok: false, error: "No On Duty record found for today. Please check your Supervisor ID." });
  }

  return jsonOut({ ok: false, error: "Unknown action" });
}

function extractDate(val) {
  if (!val || val === "") return "";
  if (Object.prototype.toString.call(val) === "[object Date]") {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    var parts = s.split(" ")[0].split("/");
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  return s;
}

function uploadPhoto(folder, base64Data, fileName) {
  try {
    var parts = base64Data.split(",");
    var mimeType = parts[0].match(/:(.*?);/)[1];
    var decoded = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(decoded, mimeType, fileName + ".jpg");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/file/d/" + file.getId() + "/view";
  } catch (err) {
    return "Upload failed: " + err.message;
  }
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
