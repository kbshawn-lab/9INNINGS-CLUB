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

app.get('/', (req, res) => {
  res.send('9INNINGS-CLUB API Server 運作中！請存取 /api/sheets 取得資料。');
});

app.get('/api/sheets', async (req, res) => {
  try {
    if (!credentials) {
      return res.status(500).json({ success: false, error: '未偵測到 GOOGLE_CREDENTIALS 環境變數！' });
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // 💡 點擊你的 Google 試算表最下方分頁，確認分頁名稱（例如「工作表1」或「Sheet1」）
    // 如果不指定分頁名稱，直接寫 'A1:Z100'，Google API 會預設讀取第一個分頁！
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A1:Z100', // 直接寫 A1:Z100，會自動讀取第一個分頁
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '試算表無資料' });
    }

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
