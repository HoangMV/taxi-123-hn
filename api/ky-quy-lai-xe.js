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
  return [...new Set(ids.map(cleanValue).filter(Boolean))];
}

function getDonViRefId(row) {
  return cleanValue(row?.Ref_DonViQuanLyHienTai) || cleanValue(row?.Ref_DonVi);
}

async function findAppSheetRows({ appId, accessKey, region, tableName, selector }) {
  const payload = selector
    ? {
        Properties: {
          Selector: selector
        }
      }
    : {};

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
  return Array.isArray(rows) ? rows : [];
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(${tableName}, IN([${keyName}], LIST(${listValues})))`;
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
    const idKyQuy = cleanValue(
      request.query?.ID_KyQuy ||
      request.query?.idKyQuy ||
      request.body?.ID_KyQuy ||
      request.body?.idKyQuy
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idKyQuy) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_KyQuy.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idKyQuy);
    const config = { appId, accessKey, region };
    const rows = await findAppSheetRows({
      ...config,
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
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const [nhanSuRows, donViRows] = await Promise.all([
      findRowsByIds(config, 'NHANSU', 'ID_NhanSu', [row.Ref_NhanSu]),
      findRowsByIds(config, 'DONVI', 'ID_DonVi', [getDonViRefId(row)])
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
};
