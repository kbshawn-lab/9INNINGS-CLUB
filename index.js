const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process process.env.PORT || 3000;

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

// 🌐 1. 首頁：緊湊型表格（字體與欄寬縮小，適合手機直式瀏覽）
app.get('/', async (req, res) => {
  const currentSheet = req.query.sheet || '';

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 取得所有分頁名稱
    const metaData = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetList = metaData.data.sheets.map(s => s.properties.title);
    const targetSheet = currentSheet || sheetList[0];

    // 抓取該分頁資料 (範圍 A1:Z100)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheet}'!A1:Z100`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    // 產生分頁選單 HTML
    const navTabsHtml = sheetList.map(name => {
      const activeStyle = name === targetSheet 
        ? 'background-color: #003366; color: white; font-weight: bold;' 
        : 'background-color: #e2e8f0; color: #333;';
      return `<a href="/?sheet=${encodeURIComponent(name)}" style="text-decoration: none; padding: 5px 10px; font-size: 12px; border-radius: 4px; ${activeStyle}">${name}</a>`;
    }).join(' ');

    // 前 3 欄的固定寬度設定（縮小至 65px，大幅減少橫向佔用）
    const colWidth = 65; 

    // 產生表格 HTML
    let tableHtml = `<table id="dataTable" style="width: 100%; border-collapse: separate; border-spacing: 0; font-family: Arial, sans-serif; font-size: 11px;">`;
    
    // 標題列
    tableHtml += `<tr style="background-color: #003366; color: white;">`;
    headers.forEach((h, colIndex) => {
      let stickyStyle = 'position: sticky; top: 0; z-index: 20; background-color: #003366; color: white;';
      
      // 前 3 欄在標題列固定
      if (colIndex < 3) {
        const leftPos = colIndex * colWidth;
        stickyStyle = `position: sticky; top: 0; left: ${leftPos}px; z-index: 25; background-color: #002244; color: white; min-width: ${colWidth}px; max-width: ${colWidth}px;`;
      }

      tableHtml += `<th style="padding: 4px 2px; border: 1px solid #ccc; font-size: 11px; white-space: nowrap; ${stickyStyle}">${h}</th>`;
    });
    tableHtml += `</tr>`;
    
    // 資料列：5 列一組色塊模組
    dataRows.forEach((row, rowIndex) => {
      const blockIndex = Math.floor(rowIndex / 5);
      const bgColor = blockIndex % 2 === 0 ? '#ffffff' : '#edf2f7';
      const inputBgColor = blockIndex % 2 === 0 ? '#fafafa' : '#e2e8f0';

      tableHtml += `<tr style="background-color: ${bgColor};" data-row="${rowIndex}">`;
      
      headers.forEach((_, colIndex) => {
        const val = row[colIndex] || '';
        let cellStickyStyle = '';

        // 前 3 欄加上左側凍結
        if (colIndex < 3) {
          const leftPos = colIndex * colWidth;
          cellStickyStyle = `position: sticky; left: ${leftPos}px; z-index: 10; background-color: ${bgColor}; min-width: ${colWidth}px; max-width: ${colWidth}px; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.1);`;
        }

        tableHtml += `
          <td style="padding: 1px; border: 1px solid #cbd5e1; text-align: center; ${cellStickyStyle}">
            <input type="text" class="cell-input" value="${val}" style="width: 92%; min-width: 55px; padding: 2px 1px; border: 1px solid #cbd5e1; border-radius: 3px; text-align: center; font-size: 11px; background-color: ${inputBgColor};" />
          </td>`;
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
          
          /* 📌 頂部固定區塊（緊湊化） */
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
          .cell-input:focus { background-color: #fff !important; border-color: #003366 !important; outline: none; box-shadow: 0 0 3px rgba(0,51,102,0.4); }
        </style>
      </head>
      <body>
        <!-- 📌 置頂區塊 -->
        <div class="sticky-top-bar">
          <div class="header-container">
            <h1 class="title">⚾ 9INNINGS CLUB 戰績表</h1>
            <button class="save-btn" onclick="saveData()">💾 儲存修改</button>
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

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z${values.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
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
