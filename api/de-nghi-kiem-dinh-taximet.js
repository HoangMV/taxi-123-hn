function sendJson(response, statusCode, data) {
  response.status(statusCode);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.send(JSON.stringify(data));
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function getUniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(cleanValue).filter(Boolean))];
}

const findCache = new Map();
const findCacheTtlMs = 5 * 60 * 1000;

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';
  if (uniqueIds.length === 1) return buildEqualsSelector(tableName, keyName, uniqueIds[0]);

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(${tableName}, IN([${keyName}], LIST(${listValues})))`;
}

async function findAppSheetRows({ appId, accessKey, region, tableName, selector }) {
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

  const appSheetResponse = await fetch(
    `https://${region}.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`,
    {
      method: 'POST',
      headers: {
        ApplicationAccessKey: accessKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Action: 'Find',
        ...payload
      })
    }
  );

  const text = await appSheetResponse.text();
  if (!appSheetResponse.ok) {
    throw new Error(`AppSheet ${appSheetResponse.status}: ${text || 'Yêu cầu thất bại.'}`);
  }

  const rows = text ? JSON.parse(text) : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  findCache.set(cacheKey, { createdAt: Date.now(), rows: safeRows });
  return safeRows;
}

async function findRowsByIds(config, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return [];

  return findAppSheetRows({
    ...config,
    tableName,
    selector
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
    return;
  }

  const appId = process.env.REACT_APP_APP_ID || '';
  const accessKey = process.env.REACT_APP_ACCESS_KEY || '';
  const region = process.env.REACT_APP_REGION || 'www';

  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trên server. Hãy kiểm tra biến môi trường của Vercel.'
    });
    return;
  }

  try {
    const idHoSoTaximet = cleanValue(
      request.query?.ID_HoSoTaximet ||
      request.query?.idHoSoTaximet ||
      request.body?.ID_HoSoTaximet ||
      request.body?.idHoSoTaximet
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idHoSoTaximet) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HoSoTaximet.' });
      return;
    }

    const config = { appId, accessKey, region };
    const providedRow =
      request.body?.row &&
      typeof request.body.row === 'object' &&
      cleanValue(request.body.row.ID_HoSoTaximet) === idHoSoTaximet
        ? request.body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          ...config,
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
      ...config,
      tableName: 'CT_HS_KIEMDINH_TAXIMET',
      selector: buildEqualsSelector('CT_HS_KIEMDINH_TAXIMET', 'Ref_HoSoTaximet', row.ID_HoSoTaximet)
    });
    const donViKiemDinhPromise = findRowsByIds(config, 'DM_CQKD_TAXIMET', 'ID_CQKD', [row.Ref_DonViKiemDinh]);
    const chiTietRows = await chiTietPromise;
    const xePromise = findRowsByIds(
      config,
      'XE',
      'ID_Xe',
      chiTietRows.map((item) => item.Ref_Xe)
    );
    let [donViKiemDinhRows, xeRows] = await Promise.all([donViKiemDinhPromise, xePromise]);
    if (donViKiemDinhRows.length === 0 && cleanValue(row.Ref_DonViKiemDinh)) {
      donViKiemDinhRows = await findAppSheetRows({
        ...config,
        tableName: 'DM_CQKD_TAXIMET'
      });
    }

    sendJson(response, 200, {
      row,
      related: {
        HS_DE_NGHI_KIEMDINH_TAXIMET: [row],
        CT_HS_KIEMDINH_TAXIMET: chiTietRows,
        DM_CQKD_TAXIMET: donViKiemDinhRows,
        XE: xeRows
      }
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Không tải được dữ liệu đề nghị kiểm định taximet.'
    });
  }
};
