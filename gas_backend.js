/**
 * gas_backend.js - 部署至 Google Apps Script 的程式碼
 * 
 * 部署步驟：
 * 1. 開啟您的 Google 試算表，點選「擴充功能」>「Apps Script」。
 * 2. 貼上以下所有程式碼。
 * 3. 點擊「部署」>「新增部署作業」。
 * 4. 類型選擇「網頁應用程式 (Web App)」。
 * 5. 執行身分：「我自己 (您的帳號)」，具有存取權限者：「所有人」。
 * 6. 部署後，將獲得的「網址」貼入前端 js/api.js 的 GAS_URL 中。
 */

const SHEET_REGISTRATION = '報名';
const SHEET_SCHEDULE = '預賽紀錄表';

function doGet(e) {
  const tab = e.parameter.tab || 'registration';
  let sheetName = tab === 'registration' ? SHEET_REGISTRATION : SHEET_SCHEDULE;
  const cb = e.parameter.callback;

  const returnData = (obj) => {
    if (cb) {
      return ContentService.createTextOutput(`${cb}(${JSON.stringify(obj)})`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return createJsonResponse(obj);
  };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return returnData({ status: 'error', message: 'Sheet not found: ' + sheetName });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return returnData({ status: 'success', data: [] });

  const headers = data[0];
  const rows = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return returnData({ status: 'success', data: rows });
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;

    if (action === 'importRegistration') {
      return handleImportRegistration(payload);
    } else if (action === 'generateSchedule') {
      return handleGenerateSchedule(payload);
    } else if (action === 'updateScore') {
      return handleUpdateScore(payload);
    } else {
      return createJsonResponse({ status: 'error', message: 'Unknown action' });
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// 報名分組邏輯
function handleImportRegistration(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_REGISTRATION);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTRATION);
    sheet.appendRow(['編號', '隊名', '姓名', '參賽類別', '小組顏色']);
  }

  // payload is array of teams: [{id, team, name, category, groupCard}]
  const dataToAppend = payload.map(r => [r.id, r.team, r.name, r.category, r.groupCard]);
  if (dataToAppend.length > 0) {
    // 簡單作法：先清空舊資料再填入
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
    }
    sheet.getRange(2, 1, dataToAppend.length, 5).setValues(dataToAppend);
  }

  return createJsonResponse({ status: 'success', message: 'Registration imported and grouped.' });
}

// 儲存賽程邏輯
function handleGenerateSchedule(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SCHEDULE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SCHEDULE);
    sheet.appendRow(['日期', '時間', '輪次', '場地', '參賽類別', 'A隊名', 'A姓名', 'A比分', 'B隊名', 'B姓名', 'B比分', '比賽狀態']);
  }

  // 避免重複產生，此處為複寫邏輯
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).clearContent();
  }

  const rows = payload.map(m => [
    m.date, m.time, m.round, m.court, m.category,
    m.teamA, m.teamANames, m.scoreA,
    m.teamB, m.teamBNames, m.scoreB,
    m.matchStatus || '待賽'
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 12).setValues(rows);
  }

  return createJsonResponse({ status: 'success', message: 'Schedule generated.' });
}

// 更新比分邏輯
function handleUpdateScore(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULE);
  if (!sheet) return createJsonResponse({ status: 'error', message: 'Sheet not found' });

  // payload: { criteria: {date, round, court}, scoreA, scoreB }
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    // 假設 日期為0, 輪次為2, 場地為3
    // 需要考量資料格式，為了簡化，前端傳回 index 或用特定組合鍵比對
    if (data[i][2] == payload.criteria.round && data[i][3] == payload.criteria.court && data[i][4] == payload.criteria.category) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 8).setValue(payload.scoreA);  // 第8欄 H: A比分
    sheet.getRange(rowIndex, 11).setValue(payload.scoreB); // 第11欄 K: B比分
    if (payload.matchStatus) {
      sheet.getRange(rowIndex, 12).setValue(payload.matchStatus); // 第12欄 L: 比賽狀態
    }
    return createJsonResponse({ status: 'success', message: 'Score updated.' });
  } else {
    return createJsonResponse({ status: 'error', message: 'Match not found.' });
  }
}

// 建立可跨網域存取的 JSON 回應 (CORS)
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}
