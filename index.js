const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const SPREADSHEET_ID = '1vCOUP980-AfHL67Duma6h6aqq2YEuBmsV0MfeHsS1Qc';

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

// 🎨 計算 U 欄百分比漸層色 (100% 綠色 #28a745 -> 0% 紅色 #dc3545)
function getRedGreenGradientColor(valStr) {
  if (!valStr) return null;
  const num = parseFloat(valStr.toString().replace('%', '').trim());
  if (isNaN(num)) return null;

  // 限制比例在 0 ~ 1 之間
  const ratio = Math.min(Math.max(num / 100, 0), 1);

  // 起始色 (紅色): #dc3545 -> RGB(220, 53, 69)
  // 結束色 (綠色): #28a745 -> RGB(40, 167, 69)
  const r = Math.round(220 + (40 - 220) * ratio);
  const g = Math.round(53 + (167 - 53) * ratio);
  const b = Math.round(69 + (69 - 69) * ratio);

  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    // 文字白/黑自動對比
    text: '#ffffff'
  };
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

    // 判斷分頁類型
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

    // 表格字體與尺寸設定
    const tableFontSize = '8.8px';
    const inputPadding = '1px 1px';
    const thPadding = '4px 3px';
    const minInputWidth = '44px';

    // 左側 3 欄固定的寬度偏移（px）
    const colOffsets = [0, 50, 100]; 
    const rowOffsets = [0, 24, 48];

    let tableHtml = `<table id="dataTable" style="width: 100%; min-width: 700px; border-collapse: separate; border-spacing: 0; font-family: Arial, sans-serif; font-size: ${tableFontSize};">`;
    
    // 產生表格內容
    rows.forEach((row, rowIndex) => {
      // 預設斑馬紋色塊
      let rowBgColor = '#ffffff';
      let rowInputBg = '#fafafa';

      if (rowIndex > 0) {
        const rowBlockGroup = Math.floor((rowIndex - 1) / 5);
        if (rowBlockGroup % 2 === 0) {
          rowBgColor = '#ffffff';
          rowInputBg = '#fafafa';
        } else {
          rowBgColor = '#edf2f7';
          rowInputBg = '#e2e8f0';
        }
      }

      tableHtml += `<tr style="background-color: ${rowBgColor};" data-row="${rowIndex}">`;

      row.forEach((val, colIndex) => {
        // 🙈 需求 2：分析表分頁中，隱藏 B 欄 (colIndex === 1)
        if (isAnalysisSheet && colIndex === 1) {
          return;
        }

        const cellValue = val || '';
        
        let cellBgColor = rowBgColor;
        let cellInputBg = rowInputBg;
        let customTextColor = '';

        if (isAnalysisSheet) {
          // 🎨 需求 3：分析表底色統一設定
          // A3:N103 (colIndex 0~13, rowIndex 2~102) 統一底色
          if (colIndex >= 0 && colIndex <= 13 && rowIndex >= 2 && rowIndex <= 102) {
            cellBgColor = '#f1f5f9';
            cellInputBg = '#f1f5f9';
          }
          // R3:Y22 (colIndex 17~24, rowIndex 2~21) 統一底色
          else if (colIndex >= 17 && colIndex <= 24 && rowIndex >= 2 && rowIndex <= 21) {
            cellBgColor = '#e2e8f0';
            cellInputBg = '#e2e8f0';
          }

          // 🔴🟢 需求 1：U3:U22 (colIndex 20, rowIndex 2~21) 色階 (100% 綠 -> 0% 紅)
          if (colIndex === 20 && rowIndex >= 2 && rowIndex <= 21) {
            const grad = getRedGreenGradientColor(cellValue);
            if (grad) {
              cellBgColor = grad.bg;
              cellInputBg = grad.bg;
              customTextColor = `color: ${grad.text}; font-weight: bold;`;
            }
          }
        }

        // 判斷是否鎖定欄列（Freeze Scroll）
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

        // 🔒 權限管控判斷：
        // 1. 輸入資料分頁：B2:J101 可編輯
        // 2. 需求 4 & 5 (分析表)：S3:S22 (colIndex 18, rowIndex 2~21) 與 U27 (colIndex 20, rowIndex 26) 開放編輯
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
          // 第一列 (標題列)
          const headerText = (isAnalysisSheet && colIndex === 24) ? `(Y欄) ${cellValue}` : cellValue;
          tableHtml += `<th style="padding: ${thPadding}; border: 1px solid #ccc; font-size: ${tableFontSize}; white-space: nowrap; ${stickyCss}">${headerText}</th>`;
        } else {
          // 一般資料列
          // 分析表 A3:N3 (rowIndex 2, colIndex 0~13) 篩選/排序介面 (跳過已隱藏的 B 欄)
          let filterHeaderHtml = '';
          if (isAnalysisSheet && rowIndex === 2 && colIndex <= 13) {
            filterHeaderHtml = `
              <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-bottom:2px;">
                <span style="font-weight:bold; font-size:8px;">${cellValue}</span>
                <button onclick="sortTable(${colIndex}, 'asc')" style="padding:0 2px; font-size:7px; cursor:pointer;" title="升遞排序">▲</button>
                <button onclick="sortTable(${colIndex}, 'desc')" style="padding:0 2px; font-size:7px; cursor:pointer;" title="降遞排序">▼</button>
              </div>
              <input type="text" placeholder="篩選..." onkeyup="filterTable(${colIndex}, this.value)" style="width:85%; font-size:7px; padding:1px; border:1px solid #94a3b8; border-radius:2px;" />
            `;
            tableHtml += `
              <td style="padding: ${inputPadding}; border: 1px solid #cbd5e1; text-align: center; background-color: #dbeafe; ${stickyCss}">
                ${filterHeaderHtml}
              </td>`;
          } else {
            tableHtml += `
              <td style="padding: ${inputPadding}; border: 1px solid #cbd5e1; text-align: center; background-color: ${cellBgColor}; ${stickyCss}">
                <input type="text" class="cell-input" data-col="${colIndex}" value="${cellValue}" ${readonlyAttr} style="width: 92%; min-width: ${minInputWidth}; padding: ${inputPadding}; border: 1px solid #cbd5e1; border-radius: 3px; text-align: center; font-size: ${tableFontSize}; background-color: ${cellInputBg}; ${cursorStyle} ${customTextColor}" />
              </td>`;
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
          
          /* 📌 頂部固定區塊 */
          .sticky-top-bar {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: #f4f6f9;
            padding-top: 8px;
            padding-bottom: 6px;
          }
          
          .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
          .title { color: #003366; margin: 0; font-size: 16px; }
          .save-btn { background-color: #28a745; color: white; font-size: 13px; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
          .save-btn:hover { background-color: #218838; }
          .save-btn:disabled { background-color: #6c757d; cursor: not-allowed; }
          .nav-container { display: flex; gap: 6px; margin-bottom: 4px; overflow-x: auto; padding-bottom: 4px; white-space: nowrap; }
          
          /* 表格外框容器 */
          .card { 
            background: white; 
            padding: 0; 
            border-radius: 6px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            overflow: auto; 
            max-height: 80vh; 
            -webkit-overflow-scrolling: touch; 
          }
          .cell-input:focus:not([readonly]) { background-color: #fff !important; border-color: #003366 !important; outline: none; box-shadow: 0 0 3px rgba(0,51,102,0.4); }
        </style>
      </head>
      <body>
        <!-- 📌 置頂區塊 -->
        <div class="sticky-top-bar">
          <div class="header-container">
            <h1 class="title">⚾ 9INNINGS CLUB 戰績表</h1>
            ${(isInputSheet || isAnalysisSheet) ? '<button class="save-btn" onclick="saveData()">💾 儲存修改</button>' : '<span style="font-size:12px; color:#666; background:#e2e8f0; padding:4px 8px; border-radius:4px;">🔒 唯讀檢視</span>'}
          </div>
          
          <!-- 分頁標籤 -->
          <div class="nav-container">
            ${navTabsHtml}
          </div>
        </div>

        <!-- 數據表格 -->
        <div class="card">
          ${tableHtml}
        </div>

        <script>
          // 🔍 前端動態篩選功能
          const activeFilters = {};

          function filterTable(colIndex, keyword) {
            activeFilters[colIndex] = keyword.toLowerCase().trim();
            applyFiltersAndSort();
          }

          function applyFiltersAndSort() {
            const table = document.getElementById('dataTable');
            const rows = Array.from(table.querySelectorAll('tr'));

            rows.forEach(tr => {
              const rIdx = parseInt(tr.getAttribute('data-row'));
              if (rIdx >= 3 && rIdx <= 102) {
                const inputs = tr.querySelectorAll('input');
                let isMatch = true;

                for (const [cIdx, kw] of Object.entries(activeFilters)) {
                  if (kw) {
                    const matchedInput = Array.from(inputs).find(inp => parseInt(inp.getAttribute('data-col')) === parseInt(cIdx));
                    if (matchedInput) {
                      const val = matchedInput.value.toLowerCase();
                      if (!val.includes(kw)) {
                        isMatch = false;
                        break;
                      }
                    }
                  }
                }
                tr.style.display = isMatch ? '' : 'none';
              }
            });
          }

          // ↕️ 前端動態排序功能
          function sortTable(colIndex, direction) {
            const table = document.getElementById('dataTable');
            const allRows = Array.from(table.querySelectorAll('tr'));
            
            const targetRows = allRows.filter(tr => {
              const rIdx = parseInt(tr.getAttribute('data-row'));
              return rIdx >= 3 && rIdx <= 102;
            });

            targetRows.sort((a, b) => {
              const inputA = Array.from(a.querySelectorAll('input')).find(inp => parseInt(inp.getAttribute('data-col')) === colIndex);
              const inputB = Array.from(b.querySelectorAll('input')).find(inp => parseInt(inp.getAttribute('data-col')) === colIndex);

              const valA = (inputA?.value || '').trim();
              const valB = (inputB?.value || '').trim();

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

            const tbody = table.querySelector('tbody') || table;
            targetRows.forEach(tr => tbody.appendChild(tr));
          }

          async function saveData() {
            const btn = document.querySelector('.save-btn');
            if (!btn) return;
            
            btn.innerText = '⏳ 儲存中...';
            btn.disabled = true;

            const table = document.getElementById('dataTable');
            const rows = Array.from(table.querySelectorAll('tr'));
            
            // 構建完整欄位矩陣（若 Column B 隱藏則補回舊值或空值）
            const updatedValues = rows.map(tr => {
              const ths = tr.querySelectorAll('th');
              if (ths.length > 0) {
                const headerVals = Array.from(ths).map(th => th.innerText.trim());
                if ("${isAnalysisSheet}" === "true") {
                  headerVals.splice(1, 0, ""); // 補齊隱藏的 B 欄位置
                }
                return headerVals;
              }
              const inputs = tr.querySelectorAll('input');
              const rowVals = [];
              
              // 補回隱藏的 B 欄，保持陣列與 Google 試算表 1:1 對齊
              inputs.forEach(input => {
                const cIdx = parseInt(input.getAttribute('data-col'));
                rowVals[cIdx] = input.value.trim();
              });

              return rowVals;
            });

            try {
              const response = await fetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sheetName: "${targetSheet}",
                  values: updatedValues
                })
              });

              const result = await response.json();
              if (result.success) {
                alert('✅ 修改已成功更新至 Google 試算表！');
                location.reload(); // 儲存完畢自動刷新，更新公式計算結果與顏色
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
  const { sheetName, values } = req.body;

  if (!sheetName || !values) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  // 🔒 允許更新「輸入資料」與「分析表」
  const isInputSheet = sheetName.includes("輸入資料");
  const isAnalysisSheet = sheetName.includes("分析表");

  if (!isInputSheet && !isAnalysisSheet) {
    return res.status(403).json({ success: false, error: '非可編輯分頁，禁止儲存！' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 先讀取試算表中線上的原始資料（包含原本的公式與數據）
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z${values.length}`,
      valueRenderOption: 'FORMULA' // 強制讀取原始公式，避免純值覆蓋公式
    });

    const existingValues = existingRes.data.values || [];

    // 🔒 依照分頁嚴格控管允許寫入的儲存格
    const safeValues = values.map((row, rIdx) => {
      return row.map((val, cIdx) => {
        let isEditableCell = false;

        if (isInputSheet) {
          // 輸入資料分頁：B2:J101
          isEditableCell = (rIdx >= 1 && rIdx <= 100) && (cIdx >= 1 && cIdx <= 9);
        } else if (isAnalysisSheet) {
          // 分析表分頁：S3:S22 (colIndex 18, rowIndex 2~21) 與 U27 (colIndex 20, rowIndex 26)
          const isS3toS22 = (cIdx === 18 && rIdx >= 2 && rIdx <= 21);
          const isU27 = (cIdx === 20 && rIdx === 26);
          isEditableCell = isS3toS22 || isU27;
        }
        
        if (isEditableCell) {
          return val !== undefined ? val : '';
        } else {
          // 非允許區塊維持線上原始內容/公式
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

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error("更新失敗:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
