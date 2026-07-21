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

    // 抓取該分頁資料 (範圍 A1:Z100)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheet}'!A1:Z100`,
    });

    const rows = response.data.values || [];

    // 產生分頁選單 HTML
    const navTabsHtml = sheetList.map(name => {
      const activeStyle = name === targetSheet 
        ? 'background-color: #003366; color: white; font-weight: bold;' 
        : 'background-color: #e2e8f0; color: #333;';
      return `<a href="/?sheet=${encodeURIComponent(name)}" style="text-decoration: none; padding: 5px 10px; font-size: 12px; border-radius: 4px; ${activeStyle}">${name}</a>`;
    }).join(' ');

    // 統一表格字體與外觀縮小 80%
    const tableFontSize = '8.8px';
    const inputPadding = '1px 1px';
    const thPadding = '4px 3px';
    const minInputWidth = '44px';

    // 左側 3 欄固定的寬度偏移（px）
    const colOffsets = [0, 50, 100]; 
    // 頂端 3 列固定的高度偏移（px）
    const rowOffsets = [0, 24, 48];

    let tableHtml = `<table id="dataTable" style="width: 100%; min-width: 700px; border-collapse: separate; border-spacing: 0; font-family: Arial, sans-serif; font-size: ${tableFontSize};">`;
    
    // 產生表格內容
    rows.forEach((row, rowIndex) => {
      const defaultRowBlock = Math.floor(rowIndex / 5);
      const defaultBgColor = defaultRowBlock % 2 === 0 ? '#ffffff' : '#edf2f7';
      const defaultInputBg = defaultRowBlock % 2 === 0 ? '#fafafa' : '#e2e8f0';

      tableHtml += `<tr style="background-color: ${defaultBgColor};" data-row="${rowIndex}">`;

      row.forEach((val, colIndex) => {
        const cellValue = val || '';
        
        // 🎨 決定儲存格背景顏色
        let cellBgColor = defaultBgColor;
        let cellInputBg = defaultInputBg;

        if (isAnalysisSheet) {
          // 分析表專屬：第 3 欄起 (Index >= 2)，每 5 欄換色色塊
          if (colIndex >= 2) {
            const colBlockGroup = Math.floor((colIndex - 2) / 5);
            if (colBlockGroup % 2 === 0) {
              cellBgColor = '#edf2f7';
              cellInputBg = '#e2e8f0';
            } else {
              cellBgColor = '#ffffff';
              cellInputBg = '#fafafa';
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

        // 🔒 權限管控判斷：僅允許在「輸入資料」分頁的 B2:J101 (rowIndex 1~100, colIndex 1~9，即 Column B~J) 編輯
        const isEditable = isInputSheet && (rowIndex >= 1 && rowIndex <= 100) && (colIndex >= 1 && colIndex <= 9);
        const readonlyAttr = isEditable ? '' : 'readonly';
        const cursorStyle = isEditable ? 'cursor: text;' : 'cursor: not-allowed; opacity: 0.8;';

        if (rowIndex === 0) {
          // 第一列 (標題列)
          const headerText = (isAnalysisSheet && colIndex === 24) ? `(Y欄) ${cellValue}` : cellValue;
          tableHtml += `<th style="padding: ${thPadding}; border: 1px solid #ccc; font-size: ${tableFontSize}; white-space: nowrap; ${stickyCss}">${headerText}</th>`;
        } else {
          // 一般資料列
          tableHtml += `
            <td style="padding: ${inputPadding}; border: 1px solid #cbd5e1; text-align: center; background-color: ${cellBgColor}; ${stickyCss}">
              <input type="text" class="cell-input" value="${cellValue}" ${readonlyAttr} style="width: 92%; min-width: ${minInputWidth}; padding: ${inputPadding}; border: 1px solid #cbd5e1; border-radius: 3px; text-align: center; font-size: ${tableFontSize}; background-color: ${cellInputBg}; ${cursorStyle}" />
            </td>`;
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
            ${isInputSheet ? '<button class="save-btn" onclick="saveData()">💾 儲存修改</button>' : '<span style="font-size:12px; color:#666; background:#e2e8f0; padding:4px 8px; border-radius:4px;">🔒 唯讀檢視</span>'}
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
          async function saveData() {
            const btn = document.querySelector('.save-btn');
            if (!btn) return;
            
            btn.innerText = '⏳ 儲存中...';
            btn.disabled = true;

            const table = document.getElementById('dataTable');
            const rows = Array.from(table.querySelectorAll('tr'));
            
            const updatedValues = rows.map(tr => {
              const ths = tr.querySelectorAll('th');
              if (ths.length > 0) {
                return Array.from(ths).map(th => th.innerText.trim());
              }
              const inputs = tr.querySelectorAll('input');
              return Array.from(inputs).map(input => input.value.trim());
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

  // 🔒 後端權限檢查：非「輸入資料」分頁禁止寫入
  if (!sheetName.includes("輸入資料")) {
    return res.status(403).json({ success: false, error: '非權限分頁，禁止儲存！' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 先讀取線上的原始資料
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z${values.length}`,
    });

    const existingValues = existingRes.data.values || [];

    // 🔒 安全保護與公式注入
    const safeValues = values.map((row, rIdx) => {
      // 試算表中的實際 Row Number（rowIndex 0 是 Row 1，rowIndex 1 是 Row 2...）
      const sheetRowNum = rIdx + 1;

      return row.map((val, cIdx) => {
        // ⚡ 1. 自動寫入 K2:K101 公式 (rIdx 1~100 對應 Row 2~101, cIdx 10 對應 Column K)
        if (rIdx >= 1 && rIdx <= 100 && cIdx === 10) {
          return `=IF(F${sheetRowNum}>G${sheetRowNum}, "W", IF(F${sheetRowNum}=G${sheetRowNum}, "D", "L"))`;
        }

        // 🔒 2. 僅允許更新 B2:J101 範圍
        const isEditableCell = (rIdx >= 1 && rIdx <= 100) && (cIdx >= 1 && cIdx <= 9);
        if (isEditableCell) {
          return val;
        } else {
          return (existingValues[rIdx] && existingValues[rIdx][cIdx] !== undefined) 
            ? existingValues[rIdx][cIdx] 
            : val;
        }
      });
    });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z${safeValues.length}`,
      valueInputOption: 'USER_ENTERED', // 此選項會讓字串 `=IF(...)` 自動被解析為 Google 試算表公式
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
