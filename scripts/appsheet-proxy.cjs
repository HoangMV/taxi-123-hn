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

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function getUniqueIds(ids) {
  const uniqueIds = [...new Set(ids.map(cleanValue).filter(Boolean))];
  return uniqueIds;
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

async function findAppSheetRows({ tableName, selector }) {
  const payload = selector
    ? {
        Properties: {
          Selector: selector
        }
      }
    : {};

  const appSheetResponse = await fetch(`https://${region}.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`, {
    method: 'POST',
    headers: {
      ApplicationAccessKey: accessKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Action: 'Find',
      ...payload
    })
  });

  const text = await appSheetResponse.text();
  if (!appSheetResponse.ok) {
    throw new Error(`AppSheet ${appSheetResponse.status}: ${text || 'Yêu cầu thất bại.'}`);
  }

  const rows = text ? JSON.parse(text) : [];
  return Array.isArray(rows) ? rows : [];
}

function buildNhanSuSelector(ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(NHANSU, IN([ID_NhanSu], LIST(${listValues})))`;
}

async function findNhanSuByIds(ids) {
  const selector = buildNhanSuSelector(ids);
  if (!selector) return [];

  return findAppSheetRows({
    tableName: 'NHANSU',
    selector
  });
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

async function handleBanGiaoXeBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idBienBanXe = cleanValue(
      url.searchParams.get('ID_BienBanXe') ||
      url.searchParams.get('idBienBanXe') ||
      body.ID_BienBanXe ||
      body.idBienBanXe
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idBienBanXe) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_BienBanXe.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idBienBanXe);
    const rows = await findAppSheetRows({
      tableName: 'XE_BANGIAO',
      selector: `Filter(XE_BANGIAO, [ID_BienBanXe] = "${selectorValue}")`
    });
    const row = rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy biên bản bàn giao xe với ID_BienBanXe = ${idBienBanXe}.`
      });
      return;
    }

    if (!includeRelated) {
      sendJson(response, 200, {
        row,
        related: {}
      });
      return;
    }

    const nhanSuRows = await findNhanSuByIds([
      row.DaiDienBenGiao1,
      row.DaiDienBenGiao2,
      row.Ref_LaiXe
    ]);

    sendJson(response, 200, {
      row,
      related: {
        NHANSU: nhanSuRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu bàn giao xe.'
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

  if (url.pathname === '/api/ban-giao-xe') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleBanGiaoXeBundle(request, response, url);
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
