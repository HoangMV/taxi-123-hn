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
    const idHopDongLaoDong = cleanValue(
      request.query?.ID_HopDongLaoDong ||
      request.query?.idHopDongLaoDong ||
      request.body?.ID_HopDongLaoDong ||
      request.body?.idHopDongLaoDong
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idHopDongLaoDong) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HopDongLaoDong.' });
      return;
    }

    const selectorValue = escapeSelectorValue(idHopDongLaoDong);
    const config = { appId, accessKey, region };
    const rows = await findAppSheetRows({
      ...config,
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
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const [nhanSuRows, donViRows, mucLuongRows] = await Promise.all([
      findRowsByIds(config, 'NHANSU', 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy]),
      findAppSheetRows({
        ...config,
        tableName: 'DONVI'
      }),
      findRowsByIds(config, 'DM_MUCLUONG_DONGBHXH', 'ID_MucLuong', [row.MucLuongCoBan])
    ]);
    const chucDanhRows = await findRowsByIds(
      config,
      'DM_CHUCDANH',
      'ID_ChucDanh',
      [
        row.Ref_BoPhan,
        ...nhanSuRows.map((nhanSu) => nhanSu.Ref_ChucDanh)
      ]
    );
    const boPhanRows = await findRowsByIds(
      config,
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
};
