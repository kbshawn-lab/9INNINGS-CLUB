const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支援傳送更新後的表格 JSON

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

// ⚠️ 權限改為可讀寫 (spreadsheets)
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 🌐 1. 首頁：動態讀取、可輸入修改並一鍵儲存的表格網頁
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
      return `<a href="/?sheet=${encodeURIComponent(name)}" style="text-decoration: none; padding: 8px 16px; border-radius: 6px; ${activeStyle}">${name}</a>`;
    }).join(' ');

    // 產生帶有 <input> 輸入框的表格 HTML
    let tableHtml = `<table id="dataTable" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">`;
    
    // 標題列
    tableHtml += `<tr style="background-color: #003366; color: white;">`;
    headers.forEach(h => {
      tableHtml += `<th style="padding: 10px; border: 1px solid #ccc;">${h}</th>`;
    });
    tableHtml += `</tr>`;
    
    // 資料列 (變成可輸入的 <input>)
    dataRows.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? '#f9f9f9' : '#ffffff';
      tableHtml += `<tr style="background-color: ${bgColor};" data-row="${rowIndex}">`;
      
      headers.forEach((_, colIndex) => {
        const val = row[colIndex] || '';
        tableHtml += `
          <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">
            <input type="text" class="cell-input" value="${val}" style="width: 90%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center;" />
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>9INNINGS CLUB 俱樂部數據分析表</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f4f6f9; margin: 0; }
          .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .title { color: #003366; margin: 0; }
          .save-btn { background-color: #28a745; color: white; font-size: 16px; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
          .save-btn:hover { background-color: #218838; }
          .nav-container { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
          .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <h1 class="title">⚾ 9INNINGS CLUB 俱樂部數據分析表</h1>
          <button class="save-btn" onclick="saveData()">💾 儲存修改</button>
        </div>
        
        <!-- 分頁標籤 -->
        <div class="nav-container">
          ${navTabsHtml}
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
            
            // 整理標題列與資料列
            const updatedValues = rows.map(tr => {
              // 標題列
              const ths = tr.querySelectorAll('th');
              if (ths.length > 0) {
                return Array.from(ths).map(th => th.innerText.trim());
              }
              // 資料列
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

// 📡 2. 寫回 Google 試算表 (API Endpoint)
app.post('/api/update', async (req, res) => {
  const { sheetName, values } = req.body;

  if (!sheetName || !values) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 更新指定分頁整個範圍 A1:Z100
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:Z${values.length}`,
      valueInputOption: 'USER_ENTERED', // 模擬使用者手動輸入 (支援數字、文字格式自動判斷)
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
