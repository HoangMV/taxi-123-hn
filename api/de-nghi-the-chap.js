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
const refSelectorBatchSize = 30;

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return 'Filter(' + tableName + ', [' + keyName + '] = "' + escapeSelectorValue(cleanId) + '")';
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return '';
  if (uniqueIds.length === 1) return buildEqualsSelector(tableName, keyName, uniqueIds[0]);

  const listValues = uniqueIds.map((id) => '"' + escapeSelectorValue(id) + '"').join(', ');
  return 'Filter(' + tableName + ', IN([' + keyName + '], LIST(' + listValues + ')))';
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
    'https://' + region + '.appsheet.com/api/v2/apps/' + appId + '/tables/' + encodeURIComponent(tableName) + '/Action',
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
    throw new Error('AppSheet ' + appSheetResponse.status + ': ' + (text || 'Yêu cầu thất bại.'));
  }

  const rows = text ? JSON.parse(text) : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  findCache.set(cacheKey, { createdAt: Date.now(), rows: safeRows });
  return safeRows;
}

async function findRowsByIds(config, tableName, keyName, ids) {
  const uniqueIds = getUniqueIds(ids);
  if (uniqueIds.length === 0) return [];

  if (uniqueIds.length > refSelectorBatchSize) {
    const rowsByBatch = await Promise.all(
      chunkItems(uniqueIds, refSelectorBatchSize).map((idBatch) => findAppSheetRows({
        ...config,
        tableName,
        selector: buildRefSelector(tableName, keyName, idBatch)
      }))
    );
    return rowsByBatch.flat();
  }

  const selector = buildRefSelector(tableName, keyName, uniqueIds);
  if (!selector) return [];

  return findAppSheetRows({
    ...config,
    tableName,
    selector
  });
}

function getXeDonViIds(xeRows) {
  return getUniqueIds(
    (Array.isArray(xeRows) ? xeRows : []).flatMap((xe) => [xe.Ref_DonViQuanLyHienTai, xe.Ref_DonViChuQuan])
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
    const idHoSoTheChap = cleanValue(
      request.query?.ID_HoSoTheChap ||
      request.query?.idHoSoTheChap ||
      request.body?.ID_HoSoTheChap ||
      request.body?.idHoSoTheChap
    );
    const includeRelated = cleanValue(request.query?.includeRelated || request.body?.includeRelated || '1') !== '0';
    const includeVisibleRefs = cleanValue(request.query?.includeVisibleRefs || request.body?.includeVisibleRefs || '1') !== '0';
    const includeHiddenRefs = cleanValue(request.query?.includeHiddenRefs || request.body?.includeHiddenRefs || '1') !== '0';

    if (!idHoSoTheChap) {
      sendJson(response, 400, { error: 'Thiếu tham số ID_HoSoTheChap.' });
      return;
    }

    const config = { appId, accessKey, region };
    const providedRow =
      request.body?.row &&
      typeof request.body.row === 'object' &&
      cleanValue(request.body.row.ID_HoSoTheChap) === idHoSoTheChap
        ? request.body.row
        : null;
    const rows = providedRow
      ? []
      : await findAppSheetRows({
          ...config,
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

    const chiTietRows = Array.isArray(request.body?.chiTietRows)
      ? request.body.chiTietRows
      : await findAppSheetRows({
          ...config,
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

    const [xeRows, nganHangRows] = await Promise.all([
      findRowsByIds(config, 'XE', 'ID_Xe', xeIds),
      findRowsByIds(config, 'DM_NGANHANG', 'ID_NganHang', nganHangIds)
    ]);

    let theChapRows = [];
    let donViRows = [];
    let nhanSuRows = [];

    if (includeHiddenRefs) {
      const theChapIds = chiTietRows.map((item) => item.Ref_XeTheChapNganHang);
      [theChapRows, donViRows, nhanSuRows] = await Promise.all([
        findRowsByIds(config, 'XE_THECHAP_NGANHANG', 'ID_TheChap', theChapIds),
        findRowsByIds(config, 'DONVI', 'ID_DonVi', getXeDonViIds(xeRows)),
        findRowsByIds(config, 'NHANSU', 'Ref_XeHienTai', xeIds)
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
};
