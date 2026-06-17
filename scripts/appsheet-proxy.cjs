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
const findCache = new Map();
const findCacheTtlMs = 5 * 60 * 1000;
const refSelectorBatchSize = 30;

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

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getDonViRefId(row) {
  return cleanValue(row?.Ref_DonViQuanLyHienTai) || cleanValue(row?.Ref_DonVi);
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateTime(value) {
  const date = parseDateValue(value);
  return date ? date.getTime() : 0;
}

function pickThanhLyHopDong(rows, ngayLap) {
  const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (candidates.length === 0) return null;

  const ngayLapKey = toDateKey(ngayLap);
  if (ngayLapKey) {
    const exact = candidates.find((row) => toDateKey(row?.NgayThanhLy) === ngayLapKey);
    if (exact) return exact;
  }

  const lapTime = getDateTime(ngayLap);
  const notAfter = candidates
    .filter((row) => {
      const rowTime = getDateTime(row?.NgayThanhLy);
      return rowTime > 0 && (!lapTime || rowTime <= lapTime);
    })
    .sort((a, b) => getDateTime(b?.NgayThanhLy) - getDateTime(a?.NgayThanhLy));

  if (notAfter[0]) return notAfter[0];

  return [...candidates].sort((a, b) => getDateTime(b?.NgayThanhLy) - getDateTime(a?.NgayThanhLy))[0] || candidates[0];
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
  const cacheKey = JSON.stringify({ tableName, selector: selector || '' });
  const cached = findCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < findCacheTtlMs) {
    return cached.rows;
  }

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
  const safeRows = Array.isArray(rows) ? rows : [];
  findCache.set(cacheKey, { createdAt: Date.now(), rows: safeRows });
  return safeRows;
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

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';
  if (uniqueIds.length === 1) return buildEqualsSelector(tableName, keyName, uniqueIds[0]);

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(${tableName}, IN([${keyName}], LIST(${listValues})))`;
}

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
}

async function findRowsByIds(tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return [];

  if (uniqueIds.length > refSelectorBatchSize) {
    const rowsByBatch = await Promise.all(
      chunkItems(uniqueIds, refSelectorBatchSize).map((idBatch) => findAppSheetRows({
        tableName,
        selector: buildRefSelector(tableName, keyName, idBatch)
      }))
    );
    return rowsByBatch.flat();
  }

  const selector = buildRefSelector(tableName, keyName, uniqueIds);
  if (!selector) return [];

  return findAppSheetRows({
    tableName,
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

async function handleDeNghiDaoTaoLaiXeBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thi\u1ebfu c\u1ea5u h\u00ecnh AppSheet trong .env c\u1ee7a backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idHoSoDaoTao = cleanValue(
      url.searchParams.get('ID_HoSoDaoTao') ||
      url.searchParams.get('idHoSoDaoTao') ||
      body.ID_HoSoDaoTao ||
      body.idHoSoDaoTao
    );
    const includeRelated = cleanValue(url.searchParams.get('includeRelated') || body.includeRelated || '1') !== '0';

    if (!idHoSoDaoTao) {
      sendJson(response, 400, { error: 'Thi\u1ebfu tham s\u1ed1 ID_HoSoDaoTao.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_HoSoDaoTao) === idHoSoDaoTao
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'HS_DAOTAO',
          selector: buildEqualsSelector('HS_DAOTAO', 'ID_HoSoDaoTao', idHoSoDaoTao)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1 \u0111\u1ec1 ngh\u1ecb \u0111\u00e0o t\u1ea1o v\u1edbi ID_HoSoDaoTao = ${idHoSoDaoTao}.`
      });
      return;
    }

    if (!includeRelated) {
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const chiTietPromise = findAppSheetRows({
      tableName: 'CT_HS_DAOTAO',
      selector: buildEqualsSelector('CT_HS_DAOTAO', 'Ref_HoSoDaoTao', row.ID_HoSoDaoTao)
    });
    const donViPromise = findRowsByIds('DONVI', 'ID_DonVi', [row.Ref_DonViDeNghi]);
    const chiTietRows = await chiTietPromise;
    const nhanSuPromise = findRowsByIds(
      'NHANSU',
      'ID_NhanSu',
      chiTietRows.map((item) => item.Ref_NhanSu)
    );
    const [donViRows, nhanSuRows] = await Promise.all([donViPromise, nhanSuPromise]);

    sendJson(response, 200, {
      row,
      related: {
        HS_DAOTAO: [row],
        CT_HS_DAOTAO: chiTietRows,
        DONVI: donViRows,
        NHANSU: nhanSuRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u \u0111\u1ec1 ngh\u1ecb \u0111\u00e0o t\u1ea1o l\u00e1i xe.'
    });
  }
}

async function handleDeNghiCapBaoHiemBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idHoSoBaoHiem = cleanValue(
      url.searchParams.get('ID_HoSoBaoHiem') ||
      url.searchParams.get('idHoSoBaoHiem') ||
      body.ID_HoSoBaoHiem ||
      body.idHoSoBaoHiem
    );
    const includeRelated = cleanValue(url.searchParams.get('includeRelated') || body.includeRelated || '1') !== '0';

    if (!idHoSoBaoHiem) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HoSoBaoHiem.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_HoSoBaoHiem) === idHoSoBaoHiem
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'HS_DE_NGHI_BAOHIEM',
          selector: buildEqualsSelector('HS_DE_NGHI_BAOHIEM', 'ID_HoSoBaoHiem', idHoSoBaoHiem)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy hồ sơ đề nghị cấp bảo hiểm với ID_HoSoBaoHiem = ${idHoSoBaoHiem}.`
      });
      return;
    }

    if (!includeRelated) {
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const chiTietPromise = findAppSheetRows({
      tableName: 'CT_HS_DE_NGHI_BAOHIEM',
      selector: buildEqualsSelector('CT_HS_DE_NGHI_BAOHIEM', 'Ref_HoSoBaoHiem', row.ID_HoSoBaoHiem)
    });
    const congTyBaoHiemPromise = findRowsByIds('DM_CTY_BAOHIEM', 'ID_CongTyBaoHiem', [row.Ref_CongTyBaoHiem]);
    const chiTietRows = await chiTietPromise;
    const xePromise = findRowsByIds(
      'XE',
      'ID_Xe',
      chiTietRows.map((item) => item.Ref_Xe)
    );
    let [congTyBaoHiemRows, xeRows] = await Promise.all([congTyBaoHiemPromise, xePromise]);
    if (congTyBaoHiemRows.length === 0 && cleanValue(row.Ref_CongTyBaoHiem)) {
      congTyBaoHiemRows = await findAppSheetRows({
        tableName: 'DM_CTY_BAOHIEM'
      });
    }

    sendJson(response, 200, {
      row,
      related: {
        HS_DE_NGHI_BAOHIEM: [row],
        CT_HS_DE_NGHI_BAOHIEM: chiTietRows,
        DM_CTY_BAOHIEM: congTyBaoHiemRows,
        XE: xeRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu đề nghị cấp bảo hiểm.'
    });
  }
}

async function handleDeNghiKiemDinhTaximetBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idHoSoTaximet = cleanValue(
      url.searchParams.get('ID_HoSoTaximet') ||
      url.searchParams.get('idHoSoTaximet') ||
      body.ID_HoSoTaximet ||
      body.idHoSoTaximet
    );
    const includeRelated = cleanValue(url.searchParams.get('includeRelated') || body.includeRelated || '1') !== '0';

    if (!idHoSoTaximet) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HoSoTaximet.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_HoSoTaximet) === idHoSoTaximet
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'HS_DE_NGHI_KIEMDINH_TAXIMET',
          selector: buildEqualsSelector('HS_DE_NGHI_KIEMDINH_TAXIMET', 'ID_HoSoTaximet', idHoSoTaximet)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy hồ sơ đề nghị kiểm định taximet với ID_HoSoTaximet = ${idHoSoTaximet}.`
      });
      return;
    }

    if (!includeRelated) {
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const chiTietPromise = findAppSheetRows({
      tableName: 'CT_HS_KIEMDINH_TAXIMET',
      selector: buildEqualsSelector('CT_HS_KIEMDINH_TAXIMET', 'Ref_HoSoTaximet', row.ID_HoSoTaximet)
    });
    const donViPromise = findRowsByIds('DM_CQKD_TAXIMET', 'ID_CQKD', [row.Ref_DonViKiemDinh]);
    const chiTietRows = await chiTietPromise;
    const xePromise = findRowsByIds(
      'XE',
      'ID_Xe',
      chiTietRows.map((item) => item.Ref_Xe)
    );
    let [donViRows, xeRows] = await Promise.all([donViPromise, xePromise]);
    if (donViRows.length === 0 && cleanValue(row.Ref_DonViKiemDinh)) {
      donViRows = await findAppSheetRows({
        tableName: 'DM_CQKD_TAXIMET'
      });
    }

    sendJson(response, 200, {
      row,
      related: {
        HS_DE_NGHI_KIEMDINH_TAXIMET: [row],
        CT_HS_KIEMDINH_TAXIMET: chiTietRows,
        DM_CQKD_TAXIMET: donViRows,
        XE: xeRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu đề nghị kiểm định taximet.'
    });
  }
}

function getTheChapDonViIds(xeRows) {
  return getUniqueIds(
    (Array.isArray(xeRows) ? xeRows : []).flatMap((xe) => [xe.Ref_DonViQuanLyHienTai, xe.Ref_DonViChuQuan])
  );
}

async function handleDeNghiTheChapBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idHoSoTheChap = cleanValue(
      url.searchParams.get('ID_HoSoTheChap') ||
      url.searchParams.get('idHoSoTheChap') ||
      body.ID_HoSoTheChap ||
      body.idHoSoTheChap
    );
    const includeRelated = cleanValue(url.searchParams.get('includeRelated') || body.includeRelated || '1') !== '0';
    const includeVisibleRefs = cleanValue(url.searchParams.get('includeVisibleRefs') || body.includeVisibleRefs || '1') !== '0';
    const includeHiddenRefs = cleanValue(url.searchParams.get('includeHiddenRefs') || body.includeHiddenRefs || '1') !== '0';
    const includeBankRefs = cleanValue(url.searchParams.get('includeBankRefs') || body.includeBankRefs || '1') !== '0';
    const includeLoanStatusRefs = cleanValue(url.searchParams.get('includeLoanStatusRefs') || body.includeLoanStatusRefs || (includeHiddenRefs ? '1' : '0')) !== '0';
    const includeOwnerRefs = cleanValue(url.searchParams.get('includeOwnerRefs') || body.includeOwnerRefs || (includeHiddenRefs ? '1' : '0')) !== '0';

    if (!idHoSoTheChap) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HoSoTheChap.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_HoSoTheChap) === idHoSoTheChap
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'XE_THECHAP_HOSO',
          selector: buildEqualsSelector('XE_THECHAP_HOSO', 'ID_HoSoTheChap', idHoSoTheChap)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: 'Không tìm thấy hồ sơ đề nghị thế chấp với ID_HoSoTheChap = ' + idHoSoTheChap + '.'
      });
      return;
    }

    if (!includeRelated) {
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const chiTietRows = Array.isArray(body.chiTietRows)
      ? body.chiTietRows
      : await findAppSheetRows({
          tableName: 'XE_THECHAP_HOSO_CHITIET',
          selector: buildEqualsSelector('XE_THECHAP_HOSO_CHITIET', 'Ref_HoSoTheChap', row.ID_HoSoTheChap)
        });

    if (!includeVisibleRefs) {
      sendJson(response, 200, {
        row,
        related: {
          XE_THECHAP_HOSO: [row],
          XE_THECHAP_HOSO_CHITIET: chiTietRows,
          XE_THECHAP_NGANHANG: [],
          DM_NGANHANG: [],
          XE: [],
          DONVI: [],
          NHANSU: []
        }
      });
      return;
    }

    const xeIds = chiTietRows.map((item) => item.Ref_Xe);
    const nganHangIds = [row.Ref_NganHang, ...chiTietRows.map((item) => item.Ref_NganHangMoi)];
    const theChapIds = chiTietRows.map((item) => item.Ref_XeTheChapNganHang);

    const [xeRows, nganHangRows, theChapRows] = await Promise.all([
      findRowsByIds('XE', 'ID_Xe', xeIds),
      includeBankRefs ? findRowsByIds('DM_NGANHANG', 'ID_NganHang', nganHangIds) : Promise.resolve([]),
      includeLoanStatusRefs ? findRowsByIds('XE_THECHAP_NGANHANG', 'ID_TheChap', theChapIds) : Promise.resolve([])
    ]);

    let donViRows = [];
    let nhanSuRows = [];

    if (includeOwnerRefs) {
      [donViRows, nhanSuRows] = await Promise.all([
        findRowsByIds('DONVI', 'ID_DonVi', getTheChapDonViIds(xeRows)),
        findRowsByIds('NHANSU', 'Ref_XeHienTai', xeIds)
      ]);
    }

    sendJson(response, 200, {
      row,
      related: {
        XE_THECHAP_HOSO: [row],
        XE_THECHAP_HOSO_CHITIET: chiTietRows,
        XE_THECHAP_NGANHANG: theChapRows,
        DM_NGANHANG: nganHangRows,
        XE: xeRows,
        DONVI: donViRows,
        NHANSU: nhanSuRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu đề nghị thế chấp.'
    });
  }
}

async function handleKyQuyLaiXeBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idKyQuy = cleanValue(
      url.searchParams.get('ID_KyQuy') ||
      url.searchParams.get('idKyQuy') ||
      body.ID_KyQuy ||
      body.idKyQuy
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idKyQuy) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_KyQuy.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idKyQuy);
    const rows = await findAppSheetRows({
      tableName: 'NHANSU_KYQUY',
      selector: `Filter(NHANSU_KYQUY, [ID_KyQuy] = "${selectorValue}")`
    });
    const row = rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy hợp đồng ký quỹ với ID_KyQuy = ${idKyQuy}.`
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

    const [nhanSuRows, donViRows] = await Promise.all([
      findRowsByIds('NHANSU', 'ID_NhanSu', [row.Ref_NhanSu]),
      findRowsByIds('DONVI', 'ID_DonVi', [getDonViRefId(row)])
    ]);

    sendJson(response, 200, {
      row,
      related: {
        NHANSU: nhanSuRows,
        DONVI: donViRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu ký quỹ lái xe.'
    });
  }
}

async function handleBanGiaoSoBhxhBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idBanGiaoSo = cleanValue(
      url.searchParams.get('ID_BanGiaoSo') ||
      url.searchParams.get('idBanGiaoSo') ||
      body.ID_BanGiaoSo ||
      body.idBanGiaoSo
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idBanGiaoSo) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_BanGiaoSo.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idBanGiaoSo);
    const rows = await findAppSheetRows({
      tableName: 'NHANSU_BHXH_BANGIAO_SO',
      selector: `Filter(NHANSU_BHXH_BANGIAO_SO, [ID_BanGiaoSo] = "${selectorValue}")`
    });
    const row = rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy biên bản bàn giao sổ BHXH với ID_BanGiaoSo = ${idBanGiaoSo}.`
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

    const bhxhRows = await findRowsByIds('NHANSU_BHXH', 'ID_BHXH', [row.Ref_BHXH]);
    const bhxh = bhxhRows[0] || null;
    const [nhanSuRows, donViRows] = await Promise.all([
      findRowsByIds('NHANSU', 'ID_NhanSu', [bhxh?.Ref_NhanSu, row.NguoiGiao, row.NguoiNhan]),
      findAppSheetRows({
        tableName: 'DONVI'
      })
    ]);
    const chucDanhRows = await findRowsByIds(
      'DM_CHUCDANH',
      'ID_ChucDanh',
      nhanSuRows.map((nhanSu) => nhanSu.Ref_ChucDanh)
    );

    sendJson(response, 200, {
      row,
      related: {
        NHANSU_BHXH: bhxhRows,
        NHANSU: nhanSuRows,
        DONVI: donViRows,
        DM_CHUCDANH: chucDanhRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu bàn giao sổ BHXH.'
    });
  }
}

async function handleHdldNhanVienLaiXeBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idHopDongLaoDong = cleanValue(
      url.searchParams.get('ID_HopDongLaoDong') ||
      url.searchParams.get('idHopDongLaoDong') ||
      body.ID_HopDongLaoDong ||
      body.idHopDongLaoDong
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idHopDongLaoDong) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HopDongLaoDong.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idHopDongLaoDong);
    const rows = await findAppSheetRows({
      tableName: 'NHANSU_HOPDONG_LAODONG',
      selector: `Filter(NHANSU_HOPDONG_LAODONG, [ID_HopDongLaoDong] = "${selectorValue}")`
    });
    const row = rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy HĐLĐ nhân viên lái xe với ID_HopDongLaoDong = ${idHopDongLaoDong}.`
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

    const [nhanSuRows, donViRows, mucLuongRows] = await Promise.all([
      findRowsByIds('NHANSU', 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy]),
      findAppSheetRows({
        tableName: 'DONVI'
      }),
      findRowsByIds('DM_MUCLUONG_DONGBHXH', 'ID_MucLuong', [row.MucLuongCoBan])
    ]);
    const chucDanhRows = await findRowsByIds(
      'DM_CHUCDANH',
      'ID_ChucDanh',
      [
        row.Ref_BoPhan,
        ...nhanSuRows.map((nhanSu) => nhanSu.Ref_ChucDanh)
      ]
    );
    const boPhanRows = await findRowsByIds(
      'DM_BOPHAN',
      'ID_BoPhan',
      [
        row.Ref_BoPhan,
        ...chucDanhRows.map((chucDanh) => chucDanh.Ref_BoPhan)
      ]
    );

    sendJson(response, 200, {
      row,
      related: {
        NHANSU: nhanSuRows,
        DONVI: donViRows,
        DM_CHUCDANH: chucDanhRows,
        DM_BOPHAN: boPhanRows,
        DM_MUCLUONG_DONGBHXH: mucLuongRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu HĐLĐ nhân viên lái xe.'
    });
  }
}

async function handleThanhLyKyQuyLaiXeBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idThanhLy = cleanValue(
      url.searchParams.get('ID_ThanhLy') ||
      url.searchParams.get('idThanhLy') ||
      body.ID_ThanhLy ||
      body.idThanhLy
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idThanhLy) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ThanhLy.' });
      return;
    }

    const rows = await findAppSheetRows({
      tableName: 'NHANSU_KYQUY_THANHLY',
      selector: buildEqualsSelector('NHANSU_KYQUY_THANHLY', 'ID_ThanhLy', idThanhLy)
    });
    const row = rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy biên bản thanh lý ký quỹ với ID_ThanhLy = ${idThanhLy}.`
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

    const kyQuyRows = await findRowsByIds('NHANSU_KYQUY', 'ID_KyQuy', [row.Ref_KyQuy]);
    const kyQuy = kyQuyRows[0] || null;
    const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
    const donViId = getDonViRefId(kyQuy);
    const [nhanSuRows, donViRows, thanhLyHopDongRows] = await Promise.all([
      findRowsByIds('NHANSU', 'ID_NhanSu', [nhanSuId]),
      findRowsByIds('DONVI', 'ID_DonVi', [donViId]),
      nhanSuId
        ? findAppSheetRows({
            tableName: 'NHANSU_THANHLY_HOPDONG',
            selector: buildEqualsSelector('NHANSU_THANHLY_HOPDONG', 'Ref_NhanSu', nhanSuId)
          })
        : Promise.resolve([])
    ]);
    const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row.NgayLap);
    const hopDongLaoDongRows = await findRowsByIds(
      'NHANSU_HOPDONG_LAODONG',
      'ID_HopDongLaoDong',
      [thanhLyHopDong?.Ref_HopDongLD]
    );

    sendJson(response, 200, {
      row,
      related: {
        NHANSU_KYQUY: kyQuyRows,
        NHANSU: nhanSuRows,
        DONVI: donViRows,
        NHANSU_THANHLY_HOPDONG: thanhLyHopDongRows,
        NHANSU_HOPDONG_LAODONG: hopDongLaoDongRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu thanh lý ký quỹ lái xe.'
    });
  }
}

async function handleChamDutHopDongLaoDongBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idChamDutHD = cleanValue(
      url.searchParams.get('ID_ChamDutHD') ||
      url.searchParams.get('idChamDutHD') ||
      body.ID_ChamDutHD ||
      body.idChamDutHD
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idChamDutHD) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ChamDutHD.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_ChamDutHD) === idChamDutHD
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'NHANSU_CHAMDUT_HOPDONG',
          selector: buildEqualsSelector('NHANSU_CHAMDUT_HOPDONG', 'ID_ChamDutHD', idChamDutHD)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy quyết định chấm dứt HĐLĐ với ID_ChamDutHD = ${idChamDutHD}.`
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

    const [hopDongRows, nhanSuRows] = await Promise.all([
      findRowsByIds('NHANSU_HOPDONG_LAODONG', 'ID_HopDongLaoDong', [row.Ref_HopDongLD]),
      findRowsByIds('NHANSU', 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy])
    ]);
    const hopDong = hopDongRows[0] || null;
    const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
    const nguoiKy = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NguoiKy));
    const donViId =
      cleanValue(hopDong?.Ref_DonViLamViec) ||
      cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
      cleanValue(nhanSu?.Ref_DonViChuQuan);

    const [donViRows, chucDanhRows] = await Promise.all([
      findRowsByIds('DONVI', 'ID_DonVi', [donViId]),
      findRowsByIds('DM_CHUCDANH', 'ID_ChucDanh', [
        nhanSu?.Ref_ChucDanh,
        nguoiKy?.Ref_ChucDanh,
        hopDong?.Ref_BoPhan,
        nhanSu?.Ref_BoPhan
      ])
    ]);
    const chucDanh =
      chucDanhRows.find((item) => cleanValue(item.ID_ChucDanh) === cleanValue(nhanSu?.Ref_ChucDanh)) ||
      chucDanhRows.find((item) => cleanValue(item.ID_ChucDanh) === cleanValue(hopDong?.Ref_BoPhan));
    const nguoiKyChucDanh = chucDanhRows.find((item) => cleanValue(item.ID_ChucDanh) === cleanValue(nguoiKy?.Ref_ChucDanh));
    const boPhanRows = chucDanh
      ? []
      : await findRowsByIds('DM_BOPHAN', 'ID_BoPhan', [
          nhanSu?.Ref_BoPhan,
          hopDong?.Ref_BoPhan,
          chucDanh?.Ref_BoPhan,
          nguoiKyChucDanh?.Ref_BoPhan
        ]);

    sendJson(response, 200, {
      row,
      related: {
        NHANSU_HOPDONG_LAODONG: hopDongRows,
        NHANSU: nhanSuRows,
        DONVI: donViRows,
        DM_CHUCDANH: chucDanhRows,
        DM_BOPHAN: boPhanRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu chấm dứt HĐLĐ.'
    });
  }
}

async function handleThanhLyHopDongLaoDongBundle(request, response, url) {
  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trong .env của backend proxy.'
    });
    return;
  }

  try {
    const body = request.method === 'POST' ? await readJson(request) : {};
    const idThanhLyHD = cleanValue(
      url.searchParams.get('ID_ThanhLyHD') ||
      url.searchParams.get('idThanhLyHD') ||
      body.ID_ThanhLyHD ||
      body.idThanhLyHD
    );
    const includeRelated = cleanValue(
      url.searchParams.get('includeRelated') ||
      body.includeRelated ||
      '1'
    ) !== '0';

    if (!idThanhLyHD) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ThanhLyHD.' });
      return;
    }

    const providedRow =
      body.row &&
      typeof body.row === 'object' &&
      cleanValue(body.row.ID_ThanhLyHD) === idThanhLyHD
        ? body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          tableName: 'NHANSU_THANHLY_HOPDONG',
          selector: buildEqualsSelector('NHANSU_THANHLY_HOPDONG', 'ID_ThanhLyHD', idThanhLyHD)
        });
    const row = providedRow || rows[0] || null;

    if (!row) {
      sendJson(response, 404, {
        error: `Không tìm thấy biên bản thanh lý HĐLĐ với ID_ThanhLyHD = ${idThanhLyHD}.`
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

    const [nhanSuRows, hopDongRows, chamDutRows, donViRowsAll] = await Promise.all([
      findRowsByIds('NHANSU', 'ID_NhanSu', [row.Ref_NhanSu]),
      findRowsByIds('NHANSU_HOPDONG_LAODONG', 'ID_HopDongLaoDong', [row.Ref_HopDongLD]),
      findRowsByIds('NHANSU_CHAMDUT_HOPDONG', 'ID_ChamDutHD', [row.Ref_ChamDutHD]),
      findAppSheetRows({ tableName: 'DONVI' })
    ]);
    const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
    const hopDong = hopDongRows.find((item) => cleanValue(item.ID_HopDongLaoDong) === cleanValue(row.Ref_HopDongLD));
    const donViId =
      cleanValue(hopDong?.Ref_DonViLamViec) ||
      cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
      cleanValue(nhanSu?.Ref_DonViChuQuan);
    const donViRows = donViRowsAll.filter((item) => cleanValue(item.ID_DonVi) === donViId);

    sendJson(response, 200, {
      row,
      related: {
        NHANSU_THANHLY_HOPDONG: [row],
        NHANSU: nhanSuRows,
        NHANSU_HOPDONG_LAODONG: hopDongRows,
        NHANSU_CHAMDUT_HOPDONG: chamDutRows,
        DONVI: donViRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu thanh lý HĐLĐ.'
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

  if (url.pathname === '/api/de-nghi-dao-tao-lai-xe') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleDeNghiDaoTaoLaiXeBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/de-nghi-cap-bao-hiem') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleDeNghiCapBaoHiemBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/de-nghi-kiem-dinh-taximet') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleDeNghiKiemDinhTaximetBundle(request, response, url);
    return;
  }


  if (url.pathname === '/api/de-nghi-the-chap') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleDeNghiTheChapBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/ky-quy-lai-xe') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleKyQuyLaiXeBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/ban-giao-so-bhxh') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleBanGiaoSoBhxhBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/hdld-nhan-vien-lai-xe') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleHdldNhanVienLaiXeBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/thanh-ly-ky-quy-lai-xe') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleThanhLyKyQuyLaiXeBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/cham-dut-hop-dong-lao-dong') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleChamDutHopDongLaoDongBundle(request, response, url);
    return;
  }

  if (url.pathname === '/api/thanh-ly-hop-dong-lao-dong') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }
    await handleThanhLyHopDongLaoDongBundle(request, response, url);
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
