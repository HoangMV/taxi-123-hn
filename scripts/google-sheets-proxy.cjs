const fs = require('fs');
const http = require('http');
const path = require('path');
const { createGoogleSheetsHandler } = require('./google-api-handler.cjs');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const buildDir = path.join(rootDir, 'build');
const publicDir = path.join(rootDir, 'public');
const port = Number(process.env.PORT || 8787);

const apiRoutes = new Map(
  [
    'ban-giao-xe',
    'ban-giao-so-bhxh',
    'de-nghi-dao-tao-lai-xe',
    'de-nghi-cap-bao-hiem',
    'de-nghi-kiem-dinh-taximet',
    'de-nghi-the-chap',
    'ky-quy-lai-xe',
    'hdld-nhan-vien-lai-xe',
    'thanh-ly-ky-quy-lai-xe',
    'cham-dut-hop-dong-lao-dong',
    'thanh-ly-hop-dong-lao-dong',
    'de-nghi-cap-phu-hieu-xe',
    'thong-bao-ngung-phu-hieu',
    'thong-ke-phu-hieu-don-vi',
    'quyet-dinh-thu-hoi-gpkd',
    'thoa-thuan-dan-su'
  ].map((slug) => [`/api/${slug}`, createGoogleSheetsHandler(slug)])
);

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
Object.entries(env).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});

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
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }[ext] || 'application/octet-stream';
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const baseDir = fs.existsSync(buildDir) ? buildDir : publicDir;
  const resolvedPath = path.resolve(baseDir, relativePath);

  if (!resolvedPath.startsWith(baseDir)) return null;
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) return resolvedPath;

  const fallbackPath = path.join(baseDir, 'index.html');
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

function createLocalApiResponse(response) {
  return {
    statusCode: 200,
    headers: {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(payload) {
      response.writeHead(this.statusCode, this.headers);
      response.end(payload);
    }
  };
}

async function handleApi(request, response, url, handler) {
  const query = Object.fromEntries(url.searchParams.entries());
  const body = request.method === 'POST' ? await readJson(request) : {};
  await handler(
    {
      method: request.method,
      query,
      body
    },
    createLocalApiResponse(response)
  );
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const apiHandler = apiRoutes.get(url.pathname);

    if (apiHandler) {
      await handleApi(request, response, url, apiHandler);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Endpoint API không tồn tại.' });
      return;
    }

    const staticPath = resolveStaticPath(url.pathname);
    if (!staticPath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Không tìm thấy file.');
      return;
    }

    response.writeHead(200, { 'Content-Type': getContentType(staticPath) });
    fs.createReadStream(staticPath).pipe(response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Không xử lý được yêu cầu.' });
  }
});

server.listen(port, () => {
  console.log(`Google Sheets local proxy đang chạy tại http://localhost:${port}`);
});
