const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// 🌐 1. 首頁：動態讀取 Google 試算表，支援切換分頁，相容所有瀏覽器與無痕模式
app.get('/', async (req, res) => {
  const currentSheet = req.query.sheet || ''; // 讀取網址傳入的分頁名稱

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 取得試算表內所有的「分頁名稱」
    const metaData = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetList = metaData.data.sheets.map(s => s.properties.title);
    
    // 若未指定分頁，預設使用第一個分頁
    const targetSheet = currentSheet || sheetList[0];

    // 抓取該分頁的資料
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

    // 產生表格 HTML
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">`;
    tableHtml += `<tr style="background-color: #003366; color: white;">${headers.map(h => `<th style="padding: 10px; border: 1px solid #ccc;">${h}</th>`).join('')}</tr>`;
    
    dataRows.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? '#f9f9f9' : '#ffffff';
      tableHtml += `<tr style="background-color: ${bgColor};">`;
      headers.forEach((_, colIndex) => {
        tableHtml += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${row[colIndex] || ''}</td>`;
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
          .header { text-align: center; color: #003366; margin-bottom: 20px; }
          .nav-container { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
          .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚾ 9INNINGS CLUB 俱樂部數據分析表</h1>
        </div>
        
        <!-- 分頁切換按鈕區域 -->
        <div class="nav-container">
          ${navTabsHtml}
        </div>

        <!-- 數據表格區域 -->
        <div class="card">
          ${tableHtml}
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h3>載入失敗：${error.message}</h3>`);
  }
});

// 保留原始 API
app.get('/api/sheets', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A1:Z100',
    });
    res.json({ success: true, data: response.data.values });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
