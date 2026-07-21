const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 你的 Google 試算表 ID
const SPREADSHEET_ID = '1vCOUP980-AfHL67Duma6h6aqq2YEuBmsV0MfeHsS1Qc';

// 🌐 1. 首頁：直接嵌入完整 Google 試算表介面 (含分頁、可編輯)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>9INNINGS CLUB 俱樂部數據分析表</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body, html {
          width: 100%;
          height: 100%;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f4f6f9;
        }
        .header {
          height: 50px;
          background-color: #003366;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .iframe-container {
          width: 100%;
          height: calc(100% - 50px);
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ⚾ 9INNINGS CLUB 俱樂部數據分析表
      </div>
      <div class="iframe-container">
        <!-- 嵌入 Google 試算表完整編輯介面 -->
        <iframe src="https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?widget=true&amp;headers=false"></iframe>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
