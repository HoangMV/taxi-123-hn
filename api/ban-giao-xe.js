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

function buildNhanSuSelector(ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(NHANSU, IN([ID_NhanSu], LIST(${listValues})))`;
}

async function findNhanSuByIds(config, ids) {
  const selector = buildNhanSuSelector(ids);
  if (!selector) return [];

  return findAppSheetRows({
    ...config,
    tableName: 'NHANSU',
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
    const idBienBanXe = cleanValue(
      request.query?.ID_BienBanXe ||
      request.query?.idBienBanXe ||
      request.body?.ID_BienBanXe ||
      request.body?.idBienBanXe
    );
    const includeRelated = cleanValue(
      request.query?.includeRelated ||
      request.body?.includeRelated ||
      '1'
    ) !== '0';

    if (!idBienBanXe) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_BienBanXe.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idBienBanXe);
    const config = {
      appId,
      accessKey,
      region
    };
    const rows = await findAppSheetRows({
      ...config,
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

    const nhanSuRows = await findNhanSuByIds(config, [
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
};
