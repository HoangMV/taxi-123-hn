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
    const idChamDutHD = cleanValue(
      request.query?.ID_ChamDutHD ||
      request.query?.idChamDutHD ||
      request.body?.ID_ChamDutHD ||
      request.body?.idChamDutHD
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';

    if (!idChamDutHD) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_ChamDutHD.' });
      return;
    }

    const config = { appId, accessKey, region };
    const providedRow =
      request.body?.row &&
      typeof request.body.row === 'object' &&
      cleanValue(request.body.row.ID_ChamDutHD) === idChamDutHD
        ? request.body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          ...config,
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
      sendJson(response, 200, { row, related: {} });
      return;
    }

    const [hopDongRows, nhanSuRows] = await Promise.all([
      findRowsByIds(config, 'NHANSU_HOPDONG_LAODONG', 'ID_HopDongLaoDong', [row.Ref_HopDongLD]),
      findRowsByIds(config, 'NHANSU', 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy])
    ]);
    const hopDong = hopDongRows[0] || null;
    const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
    const nguoiKy = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NguoiKy));
    const donViId =
      cleanValue(hopDong?.Ref_DonViLamViec) ||
      cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
      cleanValue(nhanSu?.Ref_DonViChuQuan);

    const [donViRows, chucDanhRows] = await Promise.all([
      findRowsByIds(config, 'DONVI', 'ID_DonVi', [donViId]),
      findRowsByIds(config, 'DM_CHUCDANH', 'ID_ChucDanh', [
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
      : await findRowsByIds(config, 'DM_BOPHAN', 'ID_BoPhan', [
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
};
