// Local server for airecep.tech landing page.
// No dependencies required — run with: node server.js
// Serves the static site and stores form submissions in the ./data folder.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(ROOT, 'config.json');

// Config is re-read on every submission so config.json can be edited
// without restarting the server.
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function forwardToGoogleSheet(record) {
  const url = loadConfig().google_sheet_webhook_url;
  if (!url) return;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      redirect: 'follow'
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    console.log('Forwarded to Google Sheet: OK');
  } catch (err) {
    console.error('Google Sheet forward failed (data is still saved locally):', err.message);
  }
}

// Adds the lead to MailerLite ("Sales Script Leads" group) so the
// 6-email drip automation can send them the sales script and follow-ups.
async function forwardToMailerLite(record) {
  const config = loadConfig();
  const apiKey = config.mailerlite_api_key;
  const groupId = config.mailerlite_group_id;
  if (!apiKey || !groupId || !record.email) return;
  try {
    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        email: record.email,
        fields: {
          name: record.name || '',
          company: record.business_type || ''
        },
        groups: [groupId]
      })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    console.log('Forwarded to MailerLite: OK');
  } catch (err) {
    console.error('MailerLite forward failed (data is still saved locally):', err.message);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function appendRecord(file, record) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, file);
  let records = [];
  try {
    records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }
  records.push(record);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
  return records.length;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleSubmission(req, res, file, requiredFields) {
  let data;
  try {
    data = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
  }
  const missing = requiredFields.filter(f => !String(data[f] || '').trim());
  if (missing.length) {
    return sendJson(res, 400, { ok: false, error: 'Missing fields: ' + missing.join(', ') });
  }
  const record = { ...data, received_at: new Date().toISOString() };
  const total = appendRecord(file, record);
  console.log(`[${record.received_at}] Saved to data/${file} (total: ${total})`);
  forwardToGoogleSheet(record);
  forwardToMailerLite(record);
  return sendJson(res, 200, { ok: true });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  // Prevent path traversal; block the data folder and config from being served
  if (!filePath.startsWith(ROOT) || filePath.startsWith(DATA_DIR) || filePath === CONFIG_PATH) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/lead') {
    return handleSubmission(req, res, 'leads.json', ['name', 'email']);
  }
  if (req.method === 'POST' && req.url === '/api/booking') {
    return handleSubmission(req, res, 'bookings.json', ['name', 'email']);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  sendJson(res, 405, { ok: false, error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`airecep.tech local server running at http://localhost:${PORT}`);
  console.log(`Form submissions are saved in ${DATA_DIR}`);
});
