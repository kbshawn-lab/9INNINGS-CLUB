const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 1. 你的試算表 ID
const SPREADSHEET_ID = '1vCOUP980-AfHL67Duma6h6aqq2YEuBmsV0MfeHsS1Qc';

// 從 Railway 環境變數讀取憑證
let credentials;
try {
  const credsEnv = process.env.GOOGLE_CREDENTIALS;
  credentials = typeof credsEnv === 'string' ? JSON.parse(credsEnv) : credsEnv;
  
  if (credentials && credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
} catch (error) {
  console.error("憑證解析失敗：", error);
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// 取得試算表原始資料的函式
async function getSheetData() {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1:Z100',
  });
  return response.data.values || [];
}

// 🌐 1. 直接用瀏覽器開啟時，呈現漂亮的 HTML 表格
app.get('/', async (req, res) => {
  try {
    const rows = await getSheetData();
    if (!rows.length) return res.send('<h2>試算表無資料</h2>');

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // 產生 HTML 表格
    let tableHtml = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">`;
    tableHtml += `<tr style="background-color: #003366; color: white;">${headers.map(h => `<th style="padding: 10px;">${h}</th>`).join('')}</tr>`;
    
    dataRows.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? '#f9f9f9' : '#ffffff';
      tableHtml += `<tr style="background-color: ${bgColor};">`;
      headers.forEach((_, colIndex) => {
        tableHtml += `<style>td { padding: 8px; text-align: center; }</style><td>${row[colIndex] || ''}</td>`;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</table>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>9INNINGS CLUB 戰績分析表</title>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; padding: 20px; background-color: #f4f6f9; }
          h1 { color: #003366; text-align: center; }
          .container { overflow-x: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <h1>⚾ 9INNINGS CLUB 俱樂部分析表</h1>
        <div class="container">${tableHtml}</div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`伺服器錯誤: ${error.message}`);
  }
});

// 📡 2. 保留 JSON API 供其他網頁/程式串接
app.get('/api/sheets', async (req, res) => {
  try {
    const rows = await getSheetData();
    if (!rows.length) return res.status(404).json({ success: false, message: '無資料' });

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] || '';
      });
      return rowData;
    });

    res.json({ success: true, total: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
