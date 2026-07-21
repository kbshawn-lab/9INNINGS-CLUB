const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let credentials;
try {
  credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string' 
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS) 
    : process.env.GOOGLE_CREDENTIALS;
} catch (error) {
  console.error("無法解析 GOOGLE_CREDENTIALS，請檢查 Railway 變數設定！");
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

app.get('/api/sheets', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:Z100', // ⚠️ 如果你的試算表分頁叫別的名字（例如「工作表1」），請記得把 Sheet1 改掉
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
  console.log(`Server running on port ${PORT}`);
});
