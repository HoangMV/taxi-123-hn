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

const findCache = new Map();
const findCacheTtlMs = 5 * 60 * 1000;

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

async function findRowsByIds(config, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return [];

  return findAppSheetRows({
    ...config,
    tableName,
    selector
  });
}

function getDonViId(hopDong, nhanSu) {
  return (
    cleanValue(hopDong?.Ref_DonViLamViec) ||
    cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
    cleanValue(nhanSu?.Ref_DonViChuQuan)
  );
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
    const idThanhLyHD = cleanValue(
      request.query?.ID_ThanhLyHD ||
      request.query?.idThanhLyHD ||
      request.body?.ID_ThanhLyHD ||
      request.body?.idThanhLyHD
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idThanhLyHD) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ThanhLyHD.' });
      return;
    }

    const config = { appId, accessKey, region };
    const providedRow =
      request.body?.row &&
      typeof request.body.row === 'object' &&
      cleanValue(request.body.row.ID_ThanhLyHD) === idThanhLyHD
        ? request.body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          ...config,
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
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const [nhanSuRows, hopDongRows, chamDutRows, donViRowsAll] = await Promise.all([
      findRowsByIds(config, 'NHANSU', 'ID_NhanSu', [row.Ref_NhanSu]),
      findRowsByIds(config, 'NHANSU_HOPDONG_LAODONG', 'ID_HopDongLaoDong', [row.Ref_HopDongLD]),
      findRowsByIds(config, 'NHANSU_CHAMDUT_HOPDONG', 'ID_ChamDutHD', [row.Ref_ChamDutHD]),
      findAppSheetRows({ ...config, tableName: 'DONVI' })
    ]);
    const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
    const hopDong = hopDongRows.find((item) => cleanValue(item.ID_HopDongLaoDong) === cleanValue(row.Ref_HopDongLD));
    const donViId = getDonViId(hopDong, nhanSu);
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
};
