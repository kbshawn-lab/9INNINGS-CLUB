const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 🌟 優先讀取環境變數 SPREADSHEET_ID，若未設定則使用預設的舊 ID
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1vCOUP980-AfHL67Duma6h6aqq2YEuBmsV0MfeHsS1Qc';

// 讀取 Railway 憑證
let credentials;
try {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  credentials = typeof credsEnv === 'string' ? JSON.parse(credsEnv) : credsEnv;
  if (credentials && credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
} catch (error) {
  console.error("憑證讀取失敗:", error);
}

// 可讀寫權限
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 🎨 U 欄百分比漸層色 (100% 綠色 #28a745 -> 0% 紅色 #dc3545)
function getRedGreenGradientColor(valStr) {
  if (!valStr) return null;
  const num = parseFloat(valStr.toString().replace('%', '').trim());
  if (isNaN(num)) return null;

  const ratio = Math.min(Math.max(num / 100, 0), 1);
  const r = Math.round(220 + (40 - 220) * ratio);
  const g = Math.round(53 + (167 - 53) * ratio);
  const b = Math.round(69 + (69 - 69) * ratio);

  return { bg: `rgb(${r}, ${g}, ${b})`, text: '#ffffff' };
}

// 🎨 T 欄百分比漸層色 (100% 綠色 #28a745 -> 0% 灰色 #6c757d)
function getGreenGrayGradientColor(valStr) {
  if (!valStr) return null;
  const num = parseFloat(valStr.toString().replace('%', '').trim());
  if (isNaN(num)) return null;

  const ratio = Math.min(Math.max(num / 100, 0), 1);
  const r = Math.round(108 + (40 - 108) * ratio);
  const g = Math.round(117 + (167 - 117) * ratio);
  const b = Math.round(125 + (69 - 125) * ratio);

  return { bg: `rgb(${r}, ${g}, ${b})`, text: '#ffffff' };
}

// 🎨 W 欄色階 ( >= +5 綠色 #28a745 -> <= -5 紅色 #dc3545)
function getWColumnGradientColor(valStr) {
  if (valStr === undefined || valStr === null || valStr === '') return null;
  const num = parseFloat(valStr.toString().replace('%', '').trim());
  if (isNaN(num)) return null;

  const clamped = Math.min(Math.max(num, -5), 5);
  const ratio = (clamped + 5) / 10;

  const r = Math.round(220 + (40 - 220) * ratio);
  const g = Math.round(53 + (167 - 53) * ratio);
  const b = Math.round(69 + (69 - 69) * ratio);

  return { bg: `rgb(${r}, ${g}, ${b})`, text: '#ffffff' };
}

// 數字轉為 A1 算式的字母欄位名稱 (例如 0 -> A, 11 -> L)
function getColumnName(colIndex) {
  let columnName = "";
  let temp = colIndex + 1;
  while (temp > 0) {
    let rem = (temp - 1) % 26;
    columnName = String.fromCharCode(65 + rem) + columnName;
    temp = Math.floor((temp - rem) / 26);
  }
  return columnName;
}

// 🌐 1. 首頁
app.get('/', async (req, res) => {
  const currentSheet = req.query.sheet || '';

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 取得所有分頁名稱
    const metaData = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetList = metaData.data.sheets.map(s => s.properties.title);
    const targetSheet = currentSheet || sheetList[0];

    const isInputSheet = targetSheet.includes("輸入資料");
    const isAnalysisSheet = targetSheet.includes("分析表");
    const isTotalSheet = targetSheet.includes("總紀錄");

    // 抓取該分頁資料 (範圍 A1:Z103)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheet}'!A1:Z103`,
    });

    const rows = response.data.values || [];

    // 產生分頁選單 HTML
    const navTabsHtml = sheetList.map(name => {
      const activeStyle = name === targetSheet 
        ? 'background-color: #003366; color: white; font-weight: bold;' 
        : 'background-color: #e2e8f0; color: #333;';
      return `<a href="/?sheet=${encodeURIComponent(name)}" style="text-decoration: none; padding: 5px 10px; font-size: 12px; border-radius: 4px; ${activeStyle}">${name}</a>`;
    }).join(' ');

    const tableFontSize = '8.8px';
    const inputPadding = '1px 1px';
    const thPadding = '4px 3px';

    const colOffsets = [0, 50, 100]; 
    const rowOffsets = [0, 24, 48];

    let tableHtml = `<table id="dataTable" style="width: 100%; min-width: 950px; border-collapse: separate; border-spacing: 0; font-family: Arial, sans-serif; font-size: ${tableFontSize}; table-layout: auto;">`;
    
    rows.forEach((row, rowIndex) => {
      let rowBgColor = '#ffffff';
      let rowInputBg = '#fafafa';

      if (rowIndex > 0) {
        const rowBlockGroup = Math.floor((rowIndex - 1) / 5);
        if (rowBlockGroup % 2 === 0) {
          rowBgColor = '#ffffff';
          rowInputBg = '#ffffff';
        } else {
          if (isInputSheet) {
            rowBgColor = '#bae6fd';  // 深淺對比天藍色
            rowInputBg = '#e0f2fe';
          } else {
            rowBgColor = '#edf2f7';
            rowInputBg = '#e2e8f0';
          }
        }
      }

      tableHtml += `<tr style="background-color: ${rowBgColor};" data-row="${rowIndex}">`;

      // 「輸入資料」分頁的 L 欄 (rowIndex 1~100 即 L2:L101) 計算
      let calculatedLValue = null;
      if (isInputSheet && rowIndex >= 1 && rowIndex <= 100) {
        const valF = parseFloat(row[5]) || 0; // F欄 (colIndex 5)
        const valG = parseFloat(row[6]) || 0; // G欄 (colIndex 6)
        calculatedLValue = valF - valG;
      }

      row.forEach((val, colIndex) => {
        if (isAnalysisSheet && colIndex === 1) {
          return; // 隱藏 B 欄
        }

        // 分析表隱藏 Y 欄以後的所有欄位 (colIndex > 24)
        if (isAnalysisSheet && colIndex > 24) {
          return;
        }

        let cellValue = val || '';

        // 「輸入資料」分頁 L 欄 (colIndex 11, L2:L101) 帶入計算值
        if (isInputSheet && colIndex === 11 && calculatedLValue !== null) {
          cellValue = calculatedLValue;
        }

        let cellBgColor = rowBgColor;
        let cellInputBg = rowInputBg;
        let customTextColor = '';

        let cellWidthStyle = 'min-width: 44px;';
        let cellPaddingStyle = inputPadding;

        if (isAnalysisSheet) {
          if (colIndex === 0) {
            cellWidthStyle = 'min-width: 13px; width: 13px;';
            cellPaddingStyle = '1px 0px;';
          } else if ([6, 7, 8].includes(colIndex)) {
            cellWidthStyle = 'width: 1px; white-space: nowrap;';
            cellPaddingStyle = '1px 0px;';
          } else if (colIndex === 18) {
            cellWidthStyle = 'min-width: 132px; width: 132px;';
          } else if ([21, 22, 23, 24].includes(colIndex)) {
            cellWidthStyle = 'min-width: 44px; width: 44px; white-space: nowrap;';
          }

          if (colIndex >= 0 && colIndex <= 13 && rowIndex >= 2 && rowIndex <= 102) {
            cellBgColor = '#f1f5f9';
            cellInputBg = '#f1f5f9';
          } else if (colIndex >= 17 && colIndex <= 24 && rowIndex >= 2 && rowIndex <= 21) {
            cellBgColor = '#e2e8f0';
            cellInputBg = '#e2e8f0';
          }

          if (colIndex === 19 && rowIndex >= 2 && rowIndex <= 21) {
            const grad = getGreenGrayGradientColor(cellValue);
            if (grad) {
              cellBgColor = grad.bg;
              cellInputBg = grad.bg;
              customTextColor = `color: ${grad.text}; font-weight: bold;`;
            }
          }

          if (colIndex === 20 && rowIndex >= 2 && rowIndex <= 21) {
            const grad = getRedGreenGradientColor(cellValue);
            if (grad) {
              cellBgColor = grad.bg;
              cellInputBg = grad.bg;
              customTextColor = `color: ${grad.text}; font-weight: bold;`;
            }
          }

          if (colIndex === 22 && rowIndex >= 2 && rowIndex <= 21) {
            const grad = getWColumnGradientColor(cellValue);
            if (grad) {
              cellBgColor = grad.bg;
              cellInputBg = grad.bg;
              customTextColor = `color: ${grad.text}; font-weight: bold;`;
            }
          }
        }

        const isStickyCol = (isInputSheet || isTotalSheet) && colIndex < 3;
        const isStickyRow = (isTotalSheet && rowIndex < 3) || (!isTotalSheet && rowIndex === 0);

        let stickyCss = '';
        if (isStickyRow && isStickyCol) {
          const topOffset = isTotalSheet ? rowOffsets[rowIndex] : 0;
          stickyCss = `position: sticky; top: ${topOffset}px; left: ${colOffsets[colIndex]}px; z-index: 50; background-color: #002244; color: white;`;
        } else if (isStickyRow) {
          const topOffset = isTotalSheet ? rowOffsets[rowIndex] : 0;
          stickyCss = `position: sticky; top: ${topOffset}px; z-index: 20; background-color: #003366; color: white;`;
        } else if (isStickyCol) {
          stickyCss = `position: sticky; left: ${colOffsets[colIndex]}px; z-index: 10; background-color: ${cellBgColor};`;
        }

        let isEditable = false;
        if (isInputSheet) {
          isEditable = (rowIndex >= 1 && rowIndex <= 100) && (colIndex >= 1 && colIndex <= 9);
        } else if (isAnalysisSheet) {
          const isS3toS22 = (colIndex === 18 && rowIndex >= 2 && rowIndex <= 21);
          const isU27 = (colIndex === 20 && rowIndex === 26);
          isEditable = isS3toS22 || isU27;
        }

        const readonlyAttr = isEditable ? '' : 'readonly';
        const cursorStyle = isEditable ? 'cursor: text; background-color: #ffffff !important;' : 'cursor: not-allowed; opacity: 0.95;';

        if (rowIndex === 0) {
          const headerText = (isAnalysisSheet && colIndex === 24) ? `(Y欄) ${cellValue}` : cellValue;
          tableHtml += `<th style="padding: ${thPadding}; border: 1px solid #ccc; font-size: ${tableFontSize}; white-space: nowrap; ${stickyCss} ${cellWidthStyle}">${headerText}</th>`;
        } else {
          let filterHeaderHtml = '';
          if (isAnalysisSheet && rowIndex === 2 && colIndex <= 13) {
            if (colIndex === 0) {
              filterHeaderHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0px; height:100%;">
                  <button onclick="sortTable(${colIndex}, 'asc')" style="padding:0; font-size:6px; line-height:8px; cursor:pointer; border:none; background:transparent;" title="升遞排序">▲</button>
                  <button onclick="sortTable(${colIndex}, 'desc')" style="padding:0; font-size:6px; line-height:8px; cursor:pointer; border:none; background:transparent;" title="降遞排序">▼</button>
                </div>
              `;
            } else {
              filterHeaderHtml = `
                <div style="display:flex; align-items:center; justify-content:center; gap:1px; white-space: nowrap;">
                  <span style="font-weight:bold; font-size:8.8px;">${cellValue}</span>
                  <button onclick="sortTable(${colIndex}, 'asc')" style="padding:0; font-size:7px; cursor:pointer; border:1px solid #cbd5e1; background:#ffffff; border-radius:2px;" title="升遞排序">▲</button>
                  <button onclick="sortTable(${colIndex}, 'desc')" style="padding:0; font-size:7px; cursor:pointer; border:1px solid #cbd5e1; background:#ffffff; border-radius:2px;" title="降遞排序">▼</button>
                </div>
              `;
            }

            tableHtml += `
              <td class="table-cell" data-col="${colIndex}" style="padding: 1px 0px; border: 1px solid #cbd5e1; text-align: center; background-color: #dbeafe; ${stickyCss}">
                ${filterHeaderHtml}
              </td>`;
          } else {
            // 🌟 判斷是否為「輸入資料」分頁的 I欄(colIndex 8) 或 J欄(colIndex 9) 下拉選單
            const isDropdownI = isInputSheet && colIndex === 8 && rowIndex >= 1 && rowIndex <= 100;
            const isDropdownJ = isInputSheet && colIndex === 9 && rowIndex >= 1 && rowIndex <= 100;

            if (isDropdownI || isDropdownJ) {
              const options = isDropdownI 
                ? ['鬼才', '變化', '直球'] 
                : ['變化', '直球'];

              const currentVal = cellValue.toString().trim() || options[0];

              const optionsHtml = options.map(opt => {
                const selected = (currentVal === opt) ? 'selected' : '';
                return `<option value="${opt}" ${selected}>${opt}</option>`;
              }).join('');

              tableHtml += `
                <td class="table-cell" data-col="${colIndex}" style="padding: ${cellPaddingStyle}; border: 1px solid #cbd5e1; text-align: center; background-color: ${cellBgColor}; ${stickyCss} ${cellWidthStyle}">
                  <select class="cell-input" data-col="${colIndex}" data-original="${currentVal}" onchange="markEdited(this)" style="width: 100%; padding: 1px 0; border: 1px solid #cbd5e1; border-radius: 3px; font-size: ${tableFontSize}; background-color: #ffffff; cursor: pointer; text-align: center;">
                    ${optionsHtml}
                  </select>
                </td>`;
            } else {
              const inputWidthCss = (isAnalysisSheet && [6, 7, 8].includes(colIndex)) 
                ? 'width: 100%; box-sizing: border-box;' 
                : 'width: 92%;';

              tableHtml += `
                <td class="table-cell" data-col="${colIndex}" style="padding: ${cellPaddingStyle}; border: 1px solid #cbd5e1; text-align: center; background-color: ${cellBgColor}; ${stickyCss} ${cellWidthStyle}">
                  <input type="text" class="cell-input" data-col="${colIndex}" data-original="${cellValue}" value="${cellValue}" ${readonlyAttr} style="${inputWidthCss} padding: ${cellPaddingStyle}; border: 1px solid #cbd5e1; border-radius: 3px; text-align: center; font-size: ${tableFontSize}; background-color: ${cellInputBg}; ${cursorStyle} ${customTextColor}" oninput="handleInputLiveCalc(this, ${rowIndex}, ${colIndex}); markEdited(this);" />
                </td>`;
            }
          }
        }
      });

      tableHtml += `</tr>`;
    });

    tableHtml += `</table>`;

    res.send(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>9INNINGS CLUB 俱樂部數據分析表</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 0 6px 12px 6px; background-color: #f4f6f9; margin: 0; }
          .sticky-top-bar { position: sticky; top: 0; z-index: 1000; background-color: #f4f6f9; padding-top: 8px; padding-bottom: 6px; }
          .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
          .title { color: #003366; margin: 0; font-size: 16px; }
          .save-btn { background-color: #28a745; color: white; font-size: 13px; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
          .save-btn:hover { background-color: #218838; }
          .save-btn:disabled { background-color: #6c757d; cursor: not-allowed; }
          .nav-container { display: flex; gap: 6px; margin-bottom: 4px; overflow-x: auto; padding-bottom: 4px; white-space: nowrap; }
          .card { background: white; padding: 0; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: auto; max-height: 80vh; -webkit-overflow-scrolling: touch; }
          .cell-input:focus:not([readonly]) { background-color: #fff !important; border-color: #003366 !important; outline: none; box-shadow: 0 0 3px rgba(0,51,102,0.4); }
          
          /* 🔴 編輯過的欄位顯示紅字 */
          .cell-input.is-edited {
            color: #dc3545 !important;
            font-weight: bold !important;
          }
        </style>
      </head>
      <body>
        <div class="sticky-top-bar">
          <div class="header-container">
            <h1 class="title">⚾ 9INNINGS CLUB 戰績表</h1>
            ${(isInputSheet || isAnalysisSheet) ? '<button class="save-btn" onclick="saveData()">💾 儲存修改</button>' : '<span style="font-size:12px; color:#666; background:#e2e8f0; padding:4px 8px; border-radius:4px;">🔒 唯讀檢視</span>'}
          </div>
          <div class="nav-container">
            ${navTabsHtml}
          </div>
        </div>

        <div class="card">
          ${tableHtml}
        </div>

        <script>
          // 🔴 只在「輸入資料」分頁進行紅字標記與變更追蹤
          function markEdited(el) {
            if ("${isInputSheet}" !== "true") return;

            const originalVal = el.getAttribute('data-original') || '';
            const currentVal = el.value.trim();

            if (currentVal !== originalVal) {
              el.classList.add('is-edited');
            } else {
              el.classList.remove('is-edited');
            }
          }

          function handleInputLiveCalc(inputEl, rowIndex, colIndex) {
            if (!"${isInputSheet}" || rowIndex < 1 || rowIndex > 100) return;
            if (colIndex !== 5 && colIndex !== 6) return;

            const tr = inputEl.closest('tr');
            if (!tr) return;

            const inputF = tr.querySelector('input[data-col="5"]');
            const inputG = tr.querySelector('input[data-col="6"]');
            const inputL = tr.querySelector('input[data-col="11"]');

            if (inputF && inputG && inputL) {
              const valF = parseFloat(inputF.value) || 0;
              const valG = parseFloat(inputG.value) || 0;
              const newL = valF - valG;
              
              if (inputL.value != newL) {
                inputL.value = newL;
                markEdited(inputL);
              }
            }
          }

          function sortTable(targetColIndex, direction) {
            const table = document.getElementById('dataTable');
            
            const rows = Array.from(table.querySelectorAll('tr')).filter(tr => {
              const rIdx = parseInt(tr.getAttribute('data-row'));
              return rIdx >= 3 && rIdx <= 102;
            });

            const rowDataList = rows.map(tr => {
              const tds = Array.from(tr.querySelectorAll('td')).filter(td => {
                const cIdx = parseInt(td.getAttribute('data-col'));
                return cIdx <= 13;
              });

              const rowValues = {};
              tds.forEach(td => {
                const cIdx = parseInt(td.getAttribute('data-col'));
                const inp = td.querySelector('.cell-input');
                rowValues[cIdx] = inp ? inp.value : td.innerText.trim();
              });

              return rowValues;
            });

            rowDataList.sort((a, b) => {
              const valA = (a[targetColIndex] || '').trim();
              const valB = (b[targetColIndex] || '').trim();

              const isEmptyA = valA === '';
              const isEmptyB = valB === '';

              if (isEmptyA && isEmptyB) return 0;
              if (isEmptyA) return 1;  
              if (isEmptyB) return -1; 

              const numA = parseFloat(valA.replace('%', ''));
              const numB = parseFloat(valB.replace('%', ''));

              let result = 0;
              if (!isNaN(numA) && !isNaN(numB)) {
                result = numA - numB;
              } else {
                result = valA.localeCompare(valB, 'zh-TW');
              }

              return direction === 'asc' ? result : -result;
            });

            rows.forEach((tr, rowIndex) => {
              const sortedRowData = rowDataList[rowIndex];
              const tds = Array.from(tr.querySelectorAll('td')).filter(td => {
                const cIdx = parseInt(td.getAttribute('data-col'));
                return cIdx <= 13;
              });

              tds.forEach(td => {
                const cIdx = parseInt(td.getAttribute('data-col'));
                const inp = td.querySelector('.cell-input');
                if (inp) {
                  inp.value = sortedRowData[cIdx] !== undefined ? sortedRowData[cIdx] : '';
                  markEdited(inp);
                }
              });
            });
          }

          async function saveData() {
            const btn = document.querySelector('.save-btn');
            if (!btn) return;

            const isInputSheet = "${isInputSheet}" === "true";
            
            let payload = {};

            if (isInputSheet) {
              // 🌟 「輸入資料」分頁：只收集標記為 .is-edited 的修改資料
              const editedInputs = Array.from(document.querySelectorAll('.cell-input.is-edited'));

              if (editedInputs.length === 0) {
                alert('ℹ️ 沒有檢測到任何修改內容。');
                return;
              }

              const changes = editedInputs.map(el => {
                const tr = el.closest('tr');
                const rowIndex = parseInt(tr.getAttribute('data-row'));
                const colIndex = parseInt(el.getAttribute('data-col'));
                return {
                  rowIndex: rowIndex,
                  colIndex: colIndex,
                  value: el.value.trim()
                };
              });

              payload = {
                sheetName: "${targetSheet}",
                isPartialUpdate: true,
                changes: changes
              };
            } else {
              // 分析表等其他分頁保持舊有整表打包方式
              const table = document.getElementById('dataTable');
              const rows = Array.from(table.querySelectorAll('tr'));
              
              const updatedValues = rows.map(tr => {
                const ths = tr.querySelectorAll('th');
                if (ths.length > 0) {
                  const headerVals = Array.from(ths).map(th => th.innerText.trim());
                  if ("${isAnalysisSheet}" === "true") {
                    headerVals.splice(1, 0, ""); // 補齊隱藏的 B 欄
                  }
                  return headerVals;
                }
                const inputs = tr.querySelectorAll('.cell-input');
                const rowVals = [];
                
                inputs.forEach(input => {
                  const cIdx = parseInt(input.getAttribute('data-col'));
                  rowVals[cIdx] = input.value.trim();
                });

                return rowVals;
              });

              payload = {
                sheetName: "${targetSheet}",
                isPartialUpdate: false,
                values: updatedValues
              };
            }

            btn.innerText = '⏳ 儲存中...';
            btn.disabled = true;

            try {
              const response = await fetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              const result = await response.json();
              if (result.success) {
                alert('✅ 修改已成功更新至 Google 試算表！');
                location.reload();
              } else {
                alert('❌ 儲存失敗：' + result.error);
              }
            } catch (err) {
              alert('❌ 發生錯誤：' + err.message);
            } finally {
              btn.innerText = '💾 儲存修改';
              btn.disabled = false;
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h3>載入失敗：${error.message}</h3>`);
  }
});

// 📡 2. 寫回 Google 試算表 API
app.post('/api/update', async (req, res) => {
  const { sheetName, isPartialUpdate, changes, values } = req.body;

  if (!sheetName) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  const isInputSheet = sheetName.includes("輸入資料");
  const isAnalysisSheet = sheetName.includes("分析表");

  if (!isInputSheet && !isAnalysisSheet) {
    return res.status(403).json({ success: false, error: '非可編輯分頁，禁止儲存！' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 🌟 部分更新（僅更新「輸入資料」中有修改的儲存格）
    if (isPartialUpdate && Array.isArray(changes)) {
      const dataUpdates = changes.map(item => {
        const colLetter = getColumnName(item.colIndex);
        const rowNumber = item.rowIndex + 1; // Google Sheet 為 1-based
        const range = `'${sheetName}'!${colLetter}${rowNumber}`;

        return {
          range: range,
          values: [[item.value]]
        };
      });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: dataUpdates
        }
      });

      return res.json({ success: true, message: `成功更新 ${changes.length} 個欄位` });
    }

    // 全表更新（提供給分析表等情況）
    if (values) {
      const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A1:Z${values.length}`,
        valueRenderOption: 'FORMULA'
      });

      const existingValues = existingRes.data.values || [];

      const safeValues = values.map((row, rIdx) => {
        return row.map((val, cIdx) => {
          let isEditableCell = false;

          if (isInputSheet) {
            isEditableCell = (rIdx >= 1 && rIdx <= 100) && (cIdx >= 1 && cIdx <= 9);
          } else if (isAnalysisSheet) {
            const isS3toS22 = (cIdx === 18 && rIdx >= 2 && rIdx <= 21);
            const isU27 = (cIdx === 20 && rIdx === 26);
            isEditableCell = isS3toS22 || isU27;
          }
          
          if (isEditableCell) {
            return val !== undefined ? val : '';
          } else {
            return (existingValues[rIdx] && existingValues[rIdx][cIdx] !== undefined) 
              ? existingValues[rIdx][cIdx] 
              : '';
          }
        });
      });
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A1:Z${safeValues.length}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: safeValues,
        },
      });

      return res.json({ success: true, message: '全表更新成功' });
    }

    res.status(400).json({ success: false, error: '未提供可更新的資料' });
  } catch (error) {
    console.error("更新失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
