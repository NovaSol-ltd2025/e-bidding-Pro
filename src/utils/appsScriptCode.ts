export const APPS_SCRIPT_CODE_GS = `/**
 * @OnlyCurrentDoc
 * ระบบบันทึกและประมวลผลข้อมูลการจัดซื้อจัดจ้าง e-Bidding (Google Apps Script)
 * ทำงานเป็น Web App ถาวร 2-Way Sync รองรับ:
 * 1. ดึงข้อมูลโครงการและผลการจำลองราคาทั้งหมด (get_all_data) อัตโนมัติทุกครั้งที่เปิดเว็บ
 * 2. บันทึก/อัปเดตโครงการแบบเรียลไทม์ (save_project)
 * 3. ซิงค์โครงการทั้งหมดพร้อมกัน (sync_all_projects)
 * 4. ลบโครงการออกจากชีต (delete_project)
 * 5. บันทึกผลจำลองราคา (save_simulation)
 */

// สร้างเมนูใน Google Sheets เมื่อเปิดไฟล์
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🏛️ e-Bidding Analytics')
    .addItem('📊 เปิดหน้าต่างวิเคราะห์ราคา (Web App Dialog)', 'openSidebar')
    .addItem('🧮 คำนวณผลต่างราคากลาง-งบประมาณ อัตโนมัติ', 'calculateAllRows')
    .addItem('📋 ตรวจสอบและตั้งค่าหัวตารางโครงการ (Setup Headers)', 'setupHeaders')
    .addItem('💡 ตรวจสอบและตั้งค่าหัวตารางจำลองราคา (Setup Sim Headers)', 'setupSimulationHeaders')
    .addToUi();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('e-Bidding Analytics & Price Estimator')
    .setWidth(450);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Web App: รองรับทั้ง GET และ POST เพื่อดึงข้อมูลและบันทึกข้อมูล
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'get_all_data';
    if (action === 'get_all_data' || action === 'get_projects' || action === 'get_simulations') {
      const data = getAllDataFromSheets();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...data }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // หากเปิดผ่านเบราว์เซอร์โดยตรง แสดงหน้าต่าง Web App
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('ระบบวิเคราะห์ราคา e-Bidding ภาครัฐ')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const body = JSON.parse(rawData);
    const action = body.action || 'get_all_data';

    if (action === 'get_all_data' || action === 'get_projects') {
      const data = getAllDataFromSheets();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...data }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'save_project') {
      const result = saveOrUpdateProject(body.data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'sync_all_projects') {
      const result = syncAllProjects(body.data || body.projects || []);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'delete_project') {
      const result = deleteProjectFromSheet(body.projectNo || body.id);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'save_simulation') {
      const result = saveSimulationToSheet(body.data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else {
      // ค่าเริ่มต้น บันทึกโครงการ
      const result = saveOrUpdateProject(body.data || body);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --------------------------------------------------------------------
// ดึงข้อมูลทั้งหมดจากทั้งสองชีต eBidding_Data และ Cost_Simulations
// --------------------------------------------------------------------
function getAllDataFromSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let projectSheet = ss.getSheetByName('eBidding_Data') || ss.getSheetByName('eBidding_Projects');
  if (!projectSheet) {
    setupHeaders();
    projectSheet = ss.getSheetByName('eBidding_Data');
  }
  
  let simSheet = ss.getSheetByName('Cost_Simulations');
  if (!simSheet) {
    setupSimulationHeaders();
    simSheet = ss.getSheetByName('Cost_Simulations');
  }

  const projects = [];
  const pLastRow = projectSheet.getLastRow();
  if (pLastRow >= 2) {
    const pValues = projectSheet.getRange(2, 1, pLastRow - 1, 22).getValues();
    for (let i = 0; i < pValues.length; i++) {
      const row = pValues[i];
      const projectNo = String(row[0] || '').trim();
      if (!projectNo || projectNo.includes('เลขที่โครงการ')) continue;

      const medianPrice = Number(String(row[5]).replace(/[^0-9.-]+/g, '')) || 0;
      const budgetPrice = Number(String(row[6]).replace(/[^0-9.-]+/g, '')) || medianPrice;
      const winningPrice = Number(String(row[7]).replace(/[^0-9.-]+/g, '')) || 0;
      const totalWorkers = Number(row[15]) || 1;
      const supervisors = Number(row[16]) || 0;
      const workerStaff = Number(row[17]) || Math.max(0, totalWorkers - supervisors);

      const safeMedian = medianPrice || 1;
      const safeBudget = budgetPrice || 1;
      const diffMedian = Number(row[9]) || (medianPrice - winningPrice);
      const diffMedianPct = typeof row[10] === 'number' ? row[10] : parseFloat(String(row[10]).replace('%', '')) || Number(((diffMedian / safeMedian) * 100).toFixed(2));
      const diffBudget = Number(row[11]) || (budgetPrice - winningPrice);
      const diffBudgetPct = typeof row[12] === 'number' ? row[12] : parseFloat(String(row[12]).replace('%', '')) || Number(((diffBudget / safeBudget) * 100).toFixed(2));
      const winningToMedianPct = typeof row[13] === 'number' ? row[13] : parseFloat(String(row[13]).replace('%', '')) || Number(((winningPrice / safeMedian) * 100).toFixed(2));
      const winningToBudgetPct = typeof row[14] === 'number' ? row[14] : parseFloat(String(row[14]).replace('%', '')) || Number(((winningPrice / safeBudget) * 100).toFixed(2));

      projects.push({
        id: 'p-' + projectNo,
        projectNo: projectNo,
        fiscalYear: Number(row[1]) || (new Date().getFullYear() + 543),
        agencyName: String(row[2] || 'ไม่ระบุหน่วยงาน'),
        projectName: String(row[3] || 'โครงการจ้างเหมาบริการ'),
        jobType: String(row[4] || 'จ้างเหมาบริการทำความสะอาดอาคาร'),
        medianPrice: medianPrice,
        budgetPrice: budgetPrice,
        winningPrice: winningPrice,
        winnerName: String(row[8] || 'ไม่ระบุ'),
        diffFromMedian: diffMedian,
        diffFromMedianPercent: diffMedianPct,
        diffFromBudget: diffBudget,
        diffFromBudgetPercent: diffBudgetPct,
        winningToMedianPercent: winningToMedianPct,
        winningToBudgetPercent: winningToBudgetPct,
        totalWorkers: totalWorkers,
        supervisors: supervisors,
        workerStaff: workerStaff,
        durationMonths: Number(row[18]) || 12,
        location: String(row[19] || 'กรุงเทพมหานคร'),
        notes: String(row[20] || ''),
        createdAt: row[21] ? new Date(row[21]).toISOString() : new Date().toISOString()
      });
    }
  }

  const simulations = [];
  const sLastRow = simSheet.getLastRow();
  if (sLastRow >= 2) {
    const sValues = simSheet.getRange(2, 1, sLastRow - 1, 24).getValues();
    for (let j = 0; j < sValues.length; j++) {
      const sRow = sValues[j];
      const simId = String(sRow[0] || '').trim();
      if (!simId || simId.includes('รหัสจำลอง')) continue;

      simulations.push({
        id: simId,
        scenarioName: String(sRow[1] || 'แผนจำลองราคา'),
        jobType: String(sRow[2] || 'จ้างเหมาบริการทำความสะอาดอาคาร'),
        agencyName: String(sRow[3] || ''),
        medianPrice: Number(sRow[4]) || 0,
        budgetPrice: Number(sRow[5]) || 0,
        totalWorkers: Number(sRow[6]) || 1,
        supervisors: Number(sRow[7]) || 0,
        dailyMinWage: Number(sRow[8]) || 380,
        supervisorMonthlyWage: Number(sRow[9]) || 18000,
        workScheduleType: String(sRow[10] || 'mon_fri'),
        hasOvertime: String(sRow[11] || '').includes('มี'),
        weekendWorkersCount: 0,
        totalLaborCostPerMonth: Number(sRow[13]) || 0,
        totalConsumablesPerMonth: Number(sRow[14]) || 0,
        machineryDepreciationPerMonth: Number(sRow[15]) || 0,
        overheadCostPerMonth: Number(sRow[16]) || 0,
        profitPercent: parseFloat(String(sRow[17]).replace('%', '')) || 10,
        profitPerMonth: Number(sRow[18]) || 0,
        recommendedPriceMonthly: Number(sRow[19]) || 0,
        recommendedPriceTotal: Number(sRow[20]) || 0,
        discountFromMedianPercent: parseFloat(String(sRow[21]).replace('%', '')) || 0,
        competitorStrategyNotes: String(sRow[22] || ''),
        createdAt: sRow[23] ? new Date(sRow[23]).toISOString() : new Date().toISOString()
      });
    }
  }

  return { projects, simulations };
}

// --------------------------------------------------------------------
// บันทึกหรืออัปเดตโครงการ eBidding_Data
// --------------------------------------------------------------------
function saveOrUpdateProject(projectData) {
  const p = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('eBidding_Data') || ss.getSheetByName('eBidding_Projects');
  if (!sheet) {
    setupHeaders();
    sheet = ss.getSheetByName('eBidding_Data');
  }

  const median = Number(p.medianPrice) || 0;
  const budget = Number(p.budgetPrice) || median;
  const winning = Number(p.winningPrice) || 0;
  const totalWorkers = Number(p.totalWorkers) || 1;
  const supervisors = Number(p.supervisors) || 0;
  const workers = Math.max(0, totalWorkers - supervisors);

  const safeMedian = median || 1;
  const safeBudget = budget || 1;
  const diffMedian = median - winning;
  const diffMedianPct = ((diffMedian / safeMedian) * 100).toFixed(2);
  const diffBudget = budget - winning;
  const diffBudgetPct = ((diffBudget / safeBudget) * 100).toFixed(2);
  const winToMedian = ((winning / safeMedian) * 100).toFixed(2);
  const winToBudget = ((winning / safeBudget) * 100).toFixed(2);

  const rowValues = [
    p.projectNo || ('PRJ-' + Date.now()),
    p.fiscalYear || new Date().getFullYear() + 543,
    p.agencyName || '',
    p.projectName || '',
    p.jobType || 'จ้างเหมาบริการทำความสะอาดอาคาร',
    median,
    budget,
    winning,
    p.winnerName || '',
    diffMedian,
    diffMedianPct + '%',
    diffBudget,
    diffBudgetPct + '%',
    winToMedian + '%',
    winToBudget + '%',
    totalWorkers,
    supervisors,
    workers,
    p.durationMonths || 12,
    p.location || 'กรุงเทพมหานคร',
    p.notes || '',
    new Date()
  ];

  // ตรวจสอบว่ามีแถวเดิมอยู่แล้วหรือไม่ ถ้ามีให้อัปเดต ถ้าไม่มีให้ append
  const lastRow = sheet.getLastRow();
  let targetRowIndex = -1;

  if (lastRow >= 2) {
    const existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingIds.length; i++) {
      if (String(existingIds[i][0]).trim() === String(p.projectNo).trim()) {
        targetRowIndex = i + 2;
        break;
      }
    }
  }

  if (targetRowIndex > 0) {
    sheet.getRange(targetRowIndex, 1, 1, 22).setValues([rowValues]);
    return { message: 'อัปเดตข้อมูลโครงการ ' + p.projectNo + ' ใน Google Sheet เรียบร้อยแล้ว', projectNo: p.projectNo };
  } else {
    sheet.appendRow(rowValues);
    return { message: 'เพิ่มโครงการใหม่ ' + p.projectNo + ' ลงใน Google Sheet เรียบร้อยแล้ว', projectNo: p.projectNo };
  }
}

// --------------------------------------------------------------------
// ซิงค์โครงการทั้งหมดพร้อมกันลงใน Google Sheet
// --------------------------------------------------------------------
function syncAllProjects(projectsArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('eBidding_Data') || ss.getSheetByName('eBidding_Projects');
  if (!sheet) {
    setupHeaders();
    sheet = ss.getSheetByName('eBidding_Data');
  }

  if (!Array.isArray(projectsArray) || projectsArray.length === 0) {
    return { message: 'ไม่มีข้อมูลโครงการที่ต้องซิงค์', count: 0 };
  }

  // ลบข้อมูลเดิมตั้งแต่แถว 2 ลงไป
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.deleteRows(2, lastRow - 1);
  }

  const rowsToInsert = projectsArray.map(p => {
    const median = Number(p.medianPrice) || 0;
    const budget = Number(p.budgetPrice) || median;
    const winning = Number(p.winningPrice) || 0;
    const totalWorkers = Number(p.totalWorkers) || 1;
    const supervisors = Number(p.supervisors) || 0;
    const workers = Math.max(0, totalWorkers - supervisors);

    const safeMedian = median || 1;
    const safeBudget = budget || 1;
    const diffMedian = median - winning;
    const diffMedianPct = ((diffMedian / safeMedian) * 100).toFixed(2);
    const diffBudget = budget - winning;
    const diffBudgetPct = ((diffBudget / safeBudget) * 100).toFixed(2);
    const winToMedian = ((winning / safeMedian) * 100).toFixed(2);
    const winToBudget = ((winning / safeBudget) * 100).toFixed(2);

    return [
      p.projectNo || '',
      p.fiscalYear || new Date().getFullYear() + 543,
      p.agencyName || '',
      p.projectName || '',
      p.jobType || 'จ้างเหมาบริการทำความสะอาดอาคาร',
      median,
      budget,
      winning,
      p.winnerName || '',
      diffMedian,
      diffMedianPct + '%',
      diffBudget,
      diffBudgetPct + '%',
      winToMedian + '%',
      winToBudget + '%',
      totalWorkers,
      supervisors,
      workers,
      p.durationMonths || 12,
      p.location || 'กรุงเทพมหานคร',
      p.notes || '',
      p.createdAt || new Date()
    ];
  });

  sheet.getRange(2, 1, rowsToInsert.length, 22).setValues(rowsToInsert);
  return { message: 'ซิงค์ข้อมูล ' + rowsToInsert.length + ' โครงการลง Google Sheet สำเร็จ', count: rowsToInsert.length };
}

// --------------------------------------------------------------------
// ลบโครงการออกจากชีต
// --------------------------------------------------------------------
function deleteProjectFromSheet(targetProjectNo) {
  if (!targetProjectNo) return { message: 'ไม่พบเลขที่โครงการที่ต้องการลบ' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('eBidding_Data') || ss.getSheetByName('eBidding_Projects');
  if (!sheet) return { message: 'ไม่พบแผ่นงาน eBidding_Data' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { message: 'ไม่มีข้อมูลในชีต' };

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    const val = String(ids[i][0]).trim();
    if (val === String(targetProjectNo).trim() || ('p-' + val) === String(targetProjectNo).trim()) {
      sheet.deleteRow(i + 2);
      return { message: 'ลบโครงการ ' + targetProjectNo + ' ออกจาก Google Sheet สำเร็จ' };
    }
  }
  return { message: 'ไม่พบแถวที่ตรงกับโครงการ ' + targetProjectNo + ' ในชีต' };
}

// --------------------------------------------------------------------
// จัดการแผ่นงาน eBidding_Data (ข้อมูลโครงการ 22 คอลัมน์)
// --------------------------------------------------------------------
function setupHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('eBidding_Data');
  if (!sheet) {
    sheet = ss.getSheetByName('eBidding_Projects');
  }
  if (!sheet) {
    sheet = ss.insertSheet('eBidding_Data');
  }

  const headers = [
    'เลขที่โครงการ', 'ปีงบประมาณ', 'ชื่อส่วนราชการ/หน่วยงาน', 'ชื่อโครงการ', 'ประเภทงาน',
    'ราคากลาง (บาท)', 'ราคางบประมาณ (บาท)', 'ราคาที่ชนะ (บาท)', 'ชื่อผู้ชนะ',
    'ผลต่างจากราคากลาง (บาท)', 'ผลต่างจากราคากลาง (%)', 'ผลต่างจากงบประมาณ (บาท)', 'ผลต่างจากงบประมาณ (%)',
    '% ราคาชนะต่อราคากลาง', '% ราคาชนะต่องบประมาณ', 'จำนวนคนงานทั้งหมด', 'จำนวนหัวหน้างาน', 'คนงานปฏิบัติการ',
    'ระยะเวลาสัญญา (เดือน)', 'พื้นที่/จังหวัด', 'หมายเหตุ', 'วันที่บันทึก'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#0f172a')
    .setFontColor('#38bdf8')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  ss.toast('ตั้งค่าหัวตาราง eBidding_Data เรียบร้อยแล้ว', 'สำเร็จ', 3);
  return sheet;
}

// --------------------------------------------------------------------
// จัดการแผ่นงาน Cost_Simulations (ประวัติจำลองราคาเสนอ 24 คอลัมน์)
// --------------------------------------------------------------------
function setupSimulationHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Cost_Simulations');
  if (!sheet) {
    sheet = ss.insertSheet('Cost_Simulations');
  }

  const simHeaders = [
    'รหัสจำลอง', 'ชื่อแผนกลยุทธ์', 'ประเภทงาน', 'หน่วยงาน', 'ราคากลาง (บาท)', 'ราคางบประมาณ (บาท)',
    'คนงานทั้งหมด', 'หัวหน้างาน', 'ค่าแรงขั้นต่ำ', 'เงินเดือนหัวหน้า', 'รูปแบบเวลาทำงาน', 'มี OT หรือไม่',
    'เวรวันหยุดเฉพาะบางคน', 'ต้นทุนแรงงาน/เดือน', 'วัสดุสิ้นเปลือง/เดือน', 'เครื่องจักร/เดือน', 'ค่าบริหาร/เดือน',
    'กำไรเป้าหมาย %', 'กำไรสุทธิ/เดือน', 'ราคาเสนอต่อเดือน', 'ราคาเสนอตลอดสัญญา (บาท)', 'ส่วนต่างราคากลาง %',
    'คู่แข่งที่จับตา / กลยุทธ์ที่ใช้', 'วันที่บันทึก'
  ];

  sheet.getRange(1, 1, 1, simHeaders.length).setValues([simHeaders]);
  sheet.getRange(1, 1, 1, simHeaders.length)
    .setBackground('#1e1b4b')
    .setFontColor('#a5b4fc')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  ss.toast('ตั้งค่าหัวตาราง Cost_Simulations เรียบร้อยแล้ว', 'สำเร็จ', 3);
  return sheet;
}

// บันทึกการจำลองราคาลงแผ่นงาน Cost_Simulations
function saveSimulationToSheet(sim) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Cost_Simulations');
  if (!sheet) {
    sheet = setupSimulationHeaders();
  }

  const row = [
    sim.id || ('SIM-' + new Date().getTime()),
    sim.scenarioName || 'แผนจำลองราคา',
    sim.jobType || 'จ้างเหมาบริการทำความสะอาดอาคาร',
    sim.agencyName || '',
    Number(sim.medianPrice) || 0,
    Number(sim.budgetPrice) || 0,
    Number(sim.totalWorkers) || 0,
    Number(sim.supervisors) || 0,
    Number(sim.dailyMinWage) || 380,
    Number(sim.supervisorMonthlyWage) || 18000,
    sim.workScheduleType || 'mon_fri',
    sim.hasOvertime ? 'มี OT' : 'ไม่มี',
    sim.hasWeekendSkeletonCrew ? ('มีเวร ' + (sim.weekendWorkersCount || 0) + ' คน') : 'ไม่มี',
    Number(sim.totalLaborCostPerMonth) || 0,
    Number(sim.totalConsumablesPerMonth) || 0,
    Number(sim.machineryDepreciationPerMonth) || 0,
    Number(sim.overheadCostPerMonth) || 0,
    (sim.profitPercent || 10) + '%',
    Number(sim.profitPerMonth) || 0,
    Number(sim.recommendedPriceMonthly) || 0,
    Number(sim.recommendedPriceTotal) || 0,
    (sim.discountFromMedianPercent || 0) + '%',
    sim.competitorStrategyNotes || '',
    new Date()
  ];

  sheet.appendRow(row);
  return 'บันทึกประวัติจำลองราคาลง Cost_Simulations เรียบร้อยแล้ว';
}

// คำนวณผลต่างทุกแถวในชีต eBidding_Data
function calculateAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('eBidding_Data') || ss.getSheetByName('eBidding_Projects') || ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const median = Number(row[5]) || 0;
    const budget = Number(row[6]) || median;
    const winning = Number(row[7]) || 0;
    const totalWorkers = Number(row[15]) || 0;
    const supervisors = Number(row[16]) || 0;

    if (median > 0 && winning > 0) {
      const diffMedian = median - winning;
      const diffMedianPct = (diffMedian / median) * 100;
      const diffBudget = budget > 0 ? budget - winning : diffMedian;
      const diffBudgetPct = budget > 0 ? (diffBudget / budget) * 100 : diffMedianPct;
      const winToMedian = (winning / median) * 100;
      const winToBudget = budget > 0 ? (winning / budget) * 100 : winToMedian;
      const workers = Math.max(0, totalWorkers - supervisors);

      row[9] = diffMedian;
      row[10] = Number(diffMedianPct.toFixed(2)) + '%';
      row[11] = diffBudget;
      row[12] = Number(diffBudgetPct.toFixed(2)) + '%';
      row[13] = Number(winToMedian.toFixed(2)) + '%';
      row[14] = Number(winToBudget.toFixed(2)) + '%';
      row[17] = workers;
    }
  }

  sheet.getRange(2, 1, data.length, 22).setValues(data);
  ss.toast('คำนวณผลต่างราคากลาง-งบประมาณครบทุกแถวแล้ว', 'สำเร็จ', 3);
}
`;

export const APPS_SCRIPT_INDEX_HTML = `<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Chakra Petch', sans-serif;
        background-color: #0b1329;
        color: #f8fafc;
        padding: 16px;
        margin: 0;
      }
      h2 { color: #38bdf8; margin-top: 0; border-bottom: 2px solid #1e293b; padding-bottom: 8px; }
      .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .form-group { margin-bottom: 10px; }
      label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
      input, select {
        width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #334155;
        color: #fff; padding: 8px; border-radius: 6px; font-family: 'Chakra Petch', sans-serif;
      }
      button {
        background: #0284c7; color: #fff; border: none; padding: 10px 16px; border-radius: 6px;
        font-weight: 600; cursor: pointer; width: 100%; font-family: 'Chakra Petch', sans-serif;
      }
      button:hover { background: #0369a1; }
      .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
      .stat-box { background: #0f172a; padding: 8px; border-radius: 6px; border-left: 3px solid #38bdf8; }
      .stat-val { font-size: 16px; font-weight: bold; color: #38bdf8; }
      .stat-label { font-size: 11px; color: #64748b; }
    </style>
  </head>
  <body>
    <h2>🏛️ e-Bidding Decision Tool</h2>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-label">ลดเฉลี่ยจากราคากลาง</div>
        <div class="stat-val" id="avgDiscount">~11.5%</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">เกณฑ์ต้นทุนแรงงาน</div>
        <div class="stat-val">370-400 บ./วัน</div>
      </div>
    </div>

    <div class="card">
      <div class="form-group">
        <label>เลขที่โครงการ / ชื่อโครงการ</label>
        <input type="text" id="pName" placeholder="เช่น 6701234567 จ้างทำความสะอาด">
      </div>
      <div class="form-group">
        <label>หน่วยงาน</label>
        <input type="text" id="pAgency" placeholder="เช่น กรมสรรพากร">
      </div>
      <div class="form-group">
        <label>ประเภทงาน</label>
        <select id="pJobType">
          <option value="จ้างเหมาบริการทำความสะอาดอาคาร">ทำความสะอาดอาคาร</option>
          <option value="จ้างเหมาบริการรักษาความปลอดภัย">รักษาความปลอดภัย (รปภ.)</option>
          <option value="จ้างเหมาบริการดูแลภูมิทัศน์และคนสวน">คนสวน/ภูมิทัศน์</option>
          <option value="จ้างเหมาบริการงานช่างและบำรุงรักษาอาคาร">งานช่าง/ซ่อมบำรุง</option>
        </select>
      </div>
      <div class="form-group">
        <label>ราคากลาง (บาท)</label>
        <input type="number" id="pMedian" placeholder="10000000">
      </div>
      <div class="form-group">
        <label>ราคาที่ชนะ / ราคาเสนอ (บาท)</label>
        <input type="number" id="pWinning" placeholder="8800000">
      </div>
      <div class="form-group">
        <label>จำนวนคนงานทั้งหมด (คน)</label>
        <input type="number" id="pWorkers" placeholder="30">
      </div>
      <button onclick="saveProject()">💾 บันทึกลง Google Sheet</button>
    </div>

    <script>
      function saveProject() {
        const payload = {
          projectNo: document.getElementById('pName').value,
          projectName: document.getElementById('pName').value,
          agencyName: document.getElementById('pAgency').value,
          jobType: document.getElementById('pJobType').value,
          medianPrice: Number(document.getElementById('pMedian').value) || 0,
          budgetPrice: Number(document.getElementById('pMedian').value) || 0,
          winningPrice: Number(document.getElementById('pWinning').value) || 0,
          totalWorkers: Number(document.getElementById('pWorkers').value) || 1,
          supervisors: 1,
          durationMonths: 12
        };

        google.script.run
          .withSuccessHandler(function(res) {
            alert(res.message);
            document.getElementById('pName').value = '';
            document.getElementById('pMedian').value = '';
            document.getElementById('pWinning').value = '';
          })
          .withFailureHandler(function(err) {
            alert('เกิดข้อผิดพลาด: ' + err);
          })
          .addNewProjectFromWeb(JSON.stringify(payload));
      }
    </script>
  </body>
</html>
`;
