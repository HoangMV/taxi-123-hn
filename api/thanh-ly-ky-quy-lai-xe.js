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

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
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
    const idThanhLy = cleanValue(
      request.query?.ID_ThanhLy ||
      request.query?.idThanhLy ||
      request.body?.ID_ThanhLy ||
      request.body?.idThanhLy
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idThanhLy) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ThanhLy.' });
      return;
    }

    const config = { appId, accessKey, region };
    const rows = await findAppSheetRows({
      ...config,
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
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const kyQuyRows = await findRowsByIds(config, 'NHANSU_KYQUY', 'ID_KyQuy', [row.Ref_KyQuy]);
    const kyQuy = kyQuyRows[0] || null;
    const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
    const donViId = getDonViRefId(kyQuy);
    const [nhanSuRows, donViRows, thanhLyHopDongRows] = await Promise.all([
      findRowsByIds(config, 'NHANSU', 'ID_NhanSu', [nhanSuId]),
      findRowsByIds(config, 'DONVI', 'ID_DonVi', [donViId]),
      nhanSuId
        ? findAppSheetRows({
            ...config,
            tableName: 'NHANSU_THANHLY_HOPDONG',
            selector: buildEqualsSelector('NHANSU_THANHLY_HOPDONG', 'Ref_NhanSu', nhanSuId)
          })
        : Promise.resolve([])
    ]);
    const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row.NgayLap);
    const hopDongLaoDongRows = await findRowsByIds(
      config,
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
};
