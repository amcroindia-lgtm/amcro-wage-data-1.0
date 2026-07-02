function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Records");
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = getSheet();

  if (data.action === "saveEntry") {
    writeEntry(sheet, data);
    return jsonOut({ ok: true });
  }

  if (data.action === "setStatus") {
    var ok = setStatusOnSheet(sheet, data);
    return jsonOut(ok ? { ok: true } : { ok: false, error: "Row not found" });
  }

  return jsonOut({ ok: false, error: "Unknown action" });
}

// Replaces any existing rows for this site+date, then appends the fresh set.
function writeEntry(sheet, data) {
  var values = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === data.site && formatDate(values[i][1]) === data.date) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(function (rowNum) {
    sheet.deleteRow(rowNum);
  });
  data.rows.forEach(function (row) {
    sheet.appendRow([
      data.site,
      data.date,
      row.name,
      row.siteName || "",
      row.workType || "",
      row.wage,
      row.status
    ]);
  });
}

function setStatusOnSheet(sheet, data) {
  var values = sheet.getDataRange().getValues();
  var matchIdx = -1, count = -1;
  for (var j = 1; j < values.length; j++) {
    if (values[j][0] === data.site && formatDate(values[j][1]) === data.date) {
      count++;
      if (count === data.rowIndex) { matchIdx = j; break; }
    }
  }
  if (matchIdx >= 0) {
    sheet.getRange(matchIdx + 1, 7).setValue(data.status); // column G
    return true;
  }
  return false;
}

function doGet(e) {
  var action = e.parameter.action;
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1); // skip header row

  if (action === "getEntry") {
    var site = e.parameter.site, date = e.parameter.date;
    var matched = rows.filter(function (r) {
      return r[0] === site && formatDate(r[1]) === date;
    });
    return jsonOut({
      ok: true,
      rows: matched.map(function (r) {
        return { name: r[2], siteName: r[3], workType: r[4], wage: r[5], status: r[6] };
      })
    });
  }

  if (action === "listAll") {
    var grouped = {};
    rows.forEach(function (r) {
      if (!r[0]) return;
      var key = r[0] + "|" + formatDate(r[1]);
      if (!grouped[key]) grouped[key] = { site: r[0], date: formatDate(r[1]), rows: [] };
      grouped[key].rows.push({ name: r[2], siteName: r[3], workType: r[4], wage: r[5], status: r[6] });
    });
    return jsonOut({ ok: true, entries: Object.values(grouped) });
  }

  return jsonOut({ ok: false, error: "Unknown action" });
}

function formatDate(val) {
  if (Object.prototype.toString.call(val) === "[object Date]") {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(val);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
