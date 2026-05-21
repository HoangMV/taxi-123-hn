const fs = require('fs');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const buildDir = path.join(rootDir, 'build');
const publicDir = path.join(rootDir, 'public');
const port = Number(process.env.PORT || 8787);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = value;
  });
  return result;
}

const env = { ...parseEnvFile(envPath), ...process.env };
const appId = env.REACT_APP_APP_ID || '';
const accessKey = env.REACT_APP_ACCESS_KEY || '';
const region = env.REACT_APP_REGION || 'www';

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Dữ liệu gửi lên quá lớn.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Dữ liệu JSON không hợp lệ.'));
      }
    });
    request.on('error', reject);
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }[ext] || 'application/octet-stream';
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const baseDir = fs.existsSync(buildDir) ? buildDir : publicDir;
  const resolvedPath = path.resolve(baseDir, relativePath);

  if (!resolvedPath.startsWith(baseDir)) {
    return null;
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }

  const fallbackPath = path.join(baseDir, 'index.html');
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

async function handleAppSheetProxy(request, response) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = await readJson(request);
    const tableName = String(body.tableName || '').trim();
    const action = String(body.action || 'Find').trim();
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!tableName) {
      sendJson(response, 400, { error: 'Tên bảng là bắt buộc.' });
      return;
    }

    const appSheetResponse = await fetch(`https://${region}.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`, {
      method: 'POST',
      headers: {
        ApplicationAccessKey: accessKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Action: action,
        ...payload
      })
    });

    const text = await appSheetResponse.text();
    response.writeHead(appSheetResponse.status, {
      'Content-Type': appSheetResponse.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(text || '[]');
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Proxy AppSheet gặp lỗi.'
    });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/appsheet') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức POST.' });
      return;
    }
    await handleAppSheetProxy(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Phương thức không được hỗ trợ.' });
    return;
  }

  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Không tìm thấy tài nguyên.');
    return;
  }

  response.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': filePath.endsWith('runtime-config.js') ? 'no-store' : 'public, max-age=300'
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`AppSheet proxy đang chạy tại http://localhost:${port}`);
});
