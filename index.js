const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 1. 請填入你的試算表 ID
const SPREADSHEET_ID = '你的Google試算表ID';

// 2. 請將你的 JSON 憑證內容完全貼在下面的大括號內
const credentials = {
  "type": "service_account",
  "project_id": "sapient-visitor-503114-q9",
  "private_key_id": "7be9c4a487da15151bb01f46eff02dfd1432e7fc",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGUa09nxjKMOyw\nbBZT4JB4vLj7CbzN8pxWRCC+0U2getXFy8Jl5+7bzVOCFGT3JKe4FiLfA79HRamy\nm3KWPRncnfIrTVGT8xNTAaSSKQ5kfq16E/nphHOmAK2INQVDR46PKIvuJpv6KBp3\nvBJwgtwdVFsuPS9O8iTAJTi3y1IO/n4O4JQ5STWjqsJuEiWhw/G8jUjWFGksRCvU\nHQJiggLAPh/mTp92dEoAU3tb3Lt6JYhKNLRERnsLyDaPfWbDnJ+V3jHoaQf3fIrz\n5N5lMcAdp8uf8TwdST+ubjlGd8Qm0oaw4aIJ3srKsRkYaHcgYx9jOCH8UugRX9wy\n6leaUOcFAgMBAAECggEAJfMpQJp6Ru63zEbSuvhFDSWoDDnfzFU5v3RIA9vPi/8V\ne0UzjQal+Z+/9Cts6rIz+hEaWSzBZKUbBRekBMXqdgIvfkPMcZBZSVAOKv36SBbJ\noYvDDgGPk9ubWW4z9Jzz1cc/h7IRtPwJnJH7wVX5Qw+KZz3EGMpTaAV3ZgxdRors\nTL7SGu/He1Txya+TjM7ZdBxfUG6Cr3M50bCXLrOheuXa+MV3zRhKhLJF6Yp2jjBQ\nNQS7TwkYyfJAqxOtMD02fWIPFPWKfg1coXKIJMBFkqDM7sm67PiFAOxfPszDMzPc\nBfku3/7z6QN4WEIoCypg5an81mZZi/YFyRpX2gUSIQKBgQDqeQppbsJgBbg+qVhR\nJwabbXQy2c5HvDN79v9BrlxSfOp2yyxOw5zy/f0UBPsuzXt190MN8SyZHYNW6aaz\n+R7yA8FAJQ5sdXKWNQzymJDngTWUS/JgRV4j/1lLA/RquKNMuKmC6FkatlbZEPXU\nkCvO1XWIK9vtgicw3LhIuBrd+QKBgQDYhuRLyJb+N1zyJjtI4x+uji2H9JorMiy1\nZbt8qTrk20uJ8WFhPfl/sU1OtGKzbO//o6iLPcLdhUitpkfc56Hv5qcXI5a2848O\nOZA36e7WeERBQdrwCbzP1yUYKg7fXHG/eW35bKVPPZ61SYO8J5xrUHuIZOJaOqN0\ngTQEysyEbQKBgDkpQwGLD/Xqzwzvqek202SG3YIcGS7h0cdR4s63XCh77YkCZQ3a\noGOYyd7cjAPP8l5C5mT6u72kNUW19n7/p6ymf7FMl2SXiVTXIA3wZbsag95gWXlg\nz9+Eu9cO4sI1uxHUHvcb/8UEWM3YVaX5c8Sbw2hsENSpGzbNSFvqDhq5AoGBANOT\n4+rlhB2+rXT0xMNxJBkmVvldm3QQID3UvcKPfrv4STTuh/BEZdNPxjHc9AFNtqp/\nGgeNfyeEwMLmE5yZPtSz9pwWq4P0NNp6hyEL1tT9SfzWRACAE16oZVfaaRP7Oi8W\nkc7DSjlHBhkxT6eAsUjvqPZbVg9C80u5oMH6BKR1AoGAIeYrznNEZOPi0N8NlG6Q\nc5Qk6AYNzQe/1jOB2BL6EiPZdUdfECkJ90TU31CFekdh2B5jqZHRycq+jBKFCX52\nuvUCYYOP4RTtl+yrc37wQ2cxFI4zPee3eze3DdXdYNauPZl+7v/MN+/Aio5NpyHi\n5hZ2t7GdZV3S8eDczD/Go6M=\n-----END PRIVATE KEY-----\n",
  "client_email": "id-ing-club@sapient-visitor-503114-q9.iam.gserviceaccount.com",
  "client_id": "114164092053437056952",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/id-ing-club%40sapient-visitor-503114-q9.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

app.get('/', (req, res) => {
  res.send('9INNINGS-CLUB API Server 運作中！請存取 /api/sheets 取得資料。');
});

app.get('/api/sheets', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:Z100', // ⚠️ 若試算表分頁非 Sheet1，請改成你的分頁名稱（例如「工作表1」）
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
