const {
  cleanValue,
  findRowById,
  findRowsByIds,
  readGoogleSheetTables
} = require('./google-sheets-service.cjs');

function buildMap(rows, keyName) {
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [cleanValue(row?.[keyName]), row])
      .filter(([id]) => id)
  );
}

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanValue).filter(Boolean))];
}

function isLikelyAppSheetId(value) {
  const text = cleanValue(value);
  return /^[A-Z0-9]{6,12}$/i.test(text) && /[A-Z]/i.test(text);
}

function getBanGiaoXeNhanSuIds(row) {
  return uniqueValues([
    row?.DaiDienBenGiao1,
    row?.DaiDienBenGiao2,
    row?.Ref_LaiXe,
    isLikelyAppSheetId(row?.HoTenLaiXe) ? row?.HoTenLaiXe : ''
  ]);
}

function findRowsByValue(rows, keyName, value) {
  const cleanTarget = cleanValue(value);
  if (!cleanTarget) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => cleanValue(row?.[keyName]) === cleanTarget);
}

function findRowsByAnyValue(rows, keyName, values) {
  const targets = new Set(uniqueValues(values));
  if (targets.size === 0) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => targets.has(cleanValue(row?.[keyName])));
}

function getDonViRefId(row) {
  return cleanValue(row?.Ref_DonViQuanLyHienTai) || cleanValue(row?.Ref_DonVi);
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const dateValue = new Date(value.getTime());
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const dateValue = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      dateValue.getFullYear() === Number(year) &&
      dateValue.getMonth() === Number(month) - 1 &&
      dateValue.getDate() === Number(day)
    ) {
      return dateValue;
    }
  }

  const vietnameseDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (vietnameseDateMatch) {
    const [, day, month, year] = vietnameseDateMatch;
    const dateValue = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      dateValue.getFullYear() === Number(year) &&
      dateValue.getMonth() === Number(month) - 1 &&
      dateValue.getDate() === Number(day)
    ) {
      return dateValue;
    }
  }

  const parsed = new Date(text);
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

function getXeDonViIds(xeRows) {
  return uniqueValues(
    (Array.isArray(xeRows) ? xeRows : []).flatMap((xe) => [xe.Ref_DonViQuanLyHienTai, xe.Ref_DonViChuQuan])
  );
}

async function readTables(tableNames, env) {
  return readGoogleSheetTables(tableNames, env);
}

async function buildSimpleBundle({ id, includeRelated, providedRow, env, mainTable, mainKey, tableNames, buildRelated }) {
  const tables = await readTables(includeRelated ? tableNames : [mainTable], env);
  const row = providedRow || findRowById(tables[mainTable], mainKey, id);

  if (!row) return null;
  if (!includeRelated) return { row, related: {} };

  return {
    row,
    related: buildRelated(row, tables)
  };
}

const featureConfigs = {
  'ban-giao-xe': {
    idKeys: ['ID_BienBanXe', 'idBienBanXe'],
    missingIdMessage: 'Thiếu tham số ID_BienBanXe.',
    notFoundPrefix: 'Không tìm thấy biên bản bàn giao xe với ID_BienBanXe',
    failedMessage: 'Không tải được dữ liệu bàn giao xe từ Google Sheets.',
    mainKey: 'ID_BienBanXe',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'XE_BANGIAO',
      mainKey: 'ID_BienBanXe',
      tableNames: ['XE_BANGIAO', 'NHANSU'],
      buildRelated: (row, tables) => ({
        NHANSU: findRowsByIds(tables.NHANSU, 'ID_NhanSu', getBanGiaoXeNhanSuIds(row))
      })
    })
  },

  'ban-giao-so-bhxh': {
    idKeys: ['ID_BanGiaoSo', 'idBanGiaoSo'],
    missingIdMessage: 'Thiếu tham số ID_BanGiaoSo.',
    notFoundPrefix: 'Không tìm thấy biên bản bàn giao sổ BHXH với ID_BanGiaoSo',
    failedMessage: 'Không tải được dữ liệu bàn giao sổ BHXH từ Google Sheets.',
    mainKey: 'ID_BanGiaoSo',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_BHXH_BANGIAO_SO',
      mainKey: 'ID_BanGiaoSo',
      tableNames: ['NHANSU_BHXH_BANGIAO_SO', 'NHANSU_BHXH', 'NHANSU', 'DONVI', 'DM_CHUCDANH'],
      buildRelated: (row, tables) => {
        const bhxhRows = findRowsByIds(tables.NHANSU_BHXH, 'ID_BHXH', [row.Ref_BHXH]);
        const bhxh = bhxhRows[0] || null;
        const nhanSuRows = findRowsByIds(tables.NHANSU, 'ID_NhanSu', [bhxh?.Ref_NhanSu, row.NguoiGiao, row.NguoiNhan]);
        return {
          NHANSU_BHXH: bhxhRows,
          NHANSU: nhanSuRows,
          DONVI: tables.DONVI || [],
          DM_CHUCDANH: findRowsByIds(tables.DM_CHUCDANH, 'ID_ChucDanh', nhanSuRows.map((nhanSu) => nhanSu.Ref_ChucDanh))
        };
      }
    })
  },

  'de-nghi-dao-tao-lai-xe': {
    idKeys: ['ID_HoSoDaoTao', 'idHoSoDaoTao'],
    missingIdMessage: 'Thiếu tham số ID_HoSoDaoTao.',
    notFoundPrefix: 'Không tìm thấy hồ sơ đề nghị đào tạo với ID_HoSoDaoTao',
    failedMessage: 'Không tải được dữ liệu đề nghị đào tạo lái xe từ Google Sheets.',
    mainKey: 'ID_HoSoDaoTao',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'HS_DAOTAO',
      mainKey: 'ID_HoSoDaoTao',
      tableNames: ['HS_DAOTAO', 'CT_HS_DAOTAO', 'DONVI', 'NHANSU'],
      buildRelated: (row, tables) => {
        const chiTietRows = findRowsByValue(tables.CT_HS_DAOTAO, 'Ref_HoSoDaoTao', row.ID_HoSoDaoTao);
        return {
          HS_DAOTAO: [row],
          CT_HS_DAOTAO: chiTietRows,
          DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [row.Ref_DonViDeNghi]),
          NHANSU: findRowsByIds(tables.NHANSU, 'ID_NhanSu', chiTietRows.map((item) => item.Ref_NhanSu))
        };
      }
    })
  },

  'de-nghi-cap-bao-hiem': {
    idKeys: ['ID_HoSoBaoHiem', 'idHoSoBaoHiem'],
    missingIdMessage: 'Thiếu tham số ID_HoSoBaoHiem.',
    notFoundPrefix: 'Không tìm thấy hồ sơ đề nghị cấp bảo hiểm với ID_HoSoBaoHiem',
    failedMessage: 'Không tải được dữ liệu đề nghị cấp bảo hiểm từ Google Sheets.',
    mainKey: 'ID_HoSoBaoHiem',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'HS_DE_NGHI_BAOHIEM',
      mainKey: 'ID_HoSoBaoHiem',
      tableNames: ['HS_DE_NGHI_BAOHIEM', 'CT_HS_DE_NGHI_BAOHIEM', 'DM_CTY_BAOHIEM', 'XE'],
      buildRelated: (row, tables) => {
        const chiTietRows = findRowsByValue(tables.CT_HS_DE_NGHI_BAOHIEM, 'Ref_HoSoBaoHiem', row.ID_HoSoBaoHiem);
        return {
          HS_DE_NGHI_BAOHIEM: [row],
          CT_HS_DE_NGHI_BAOHIEM: chiTietRows,
          DM_CTY_BAOHIEM: tables.DM_CTY_BAOHIEM || [],
          XE: findRowsByIds(tables.XE, 'ID_Xe', chiTietRows.map((item) => item.Ref_Xe))
        };
      }
    })
  },

  'de-nghi-kiem-dinh-taximet': {
    idKeys: ['ID_HoSoTaximet', 'idHoSoTaximet'],
    missingIdMessage: 'Thiếu tham số ID_HoSoTaximet.',
    notFoundPrefix: 'Không tìm thấy hồ sơ đề nghị kiểm định taximet với ID_HoSoTaximet',
    failedMessage: 'Không tải được dữ liệu đề nghị kiểm định taximet từ Google Sheets.',
    mainKey: 'ID_HoSoTaximet',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'HS_DE_NGHI_KIEMDINH_TAXIMET',
      mainKey: 'ID_HoSoTaximet',
      tableNames: ['HS_DE_NGHI_KIEMDINH_TAXIMET', 'CT_HS_KIEMDINH_TAXIMET', 'DM_CQKD_TAXIMET', 'XE'],
      buildRelated: (row, tables) => {
        const chiTietRows = findRowsByValue(tables.CT_HS_KIEMDINH_TAXIMET, 'Ref_HoSoTaximet', row.ID_HoSoTaximet);
        return {
          HS_DE_NGHI_KIEMDINH_TAXIMET: [row],
          CT_HS_KIEMDINH_TAXIMET: chiTietRows,
          DM_CQKD_TAXIMET: tables.DM_CQKD_TAXIMET || [],
          XE: findRowsByIds(tables.XE, 'ID_Xe', chiTietRows.map((item) => item.Ref_Xe))
        };
      }
    })
  },

  'ky-quy-lai-xe': {
    idKeys: ['ID_KyQuy', 'idKyQuy'],
    missingIdMessage: 'Thiếu tham số ID_KyQuy.',
    notFoundPrefix: 'Không tìm thấy hợp đồng ký quỹ với ID_KyQuy',
    failedMessage: 'Không tải được dữ liệu ký quỹ lái xe từ Google Sheets.',
    mainKey: 'ID_KyQuy',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_KYQUY',
      mainKey: 'ID_KyQuy',
      tableNames: ['NHANSU_KYQUY', 'NHANSU', 'DONVI'],
      buildRelated: (row, tables) => ({
        NHANSU: findRowsByIds(tables.NHANSU, 'ID_NhanSu', [row.Ref_NhanSu]),
        DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [getDonViRefId(row)])
      })
    })
  },

  'hdld-nhan-vien-lai-xe': {
    idKeys: ['ID_HopDongLaoDong', 'idHopDongLaoDong'],
    missingIdMessage: 'Thiếu tham số ID_HopDongLaoDong.',
    notFoundPrefix: 'Không tìm thấy HĐLĐ nhân viên lái xe với ID_HopDongLaoDong',
    failedMessage: 'Không tải được dữ liệu HĐLĐ nhân viên lái xe từ Google Sheets.',
    mainKey: 'ID_HopDongLaoDong',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_HOPDONG_LAODONG',
      mainKey: 'ID_HopDongLaoDong',
      tableNames: ['NHANSU_HOPDONG_LAODONG', 'NHANSU', 'DONVI', 'DM_CHUCDANH', 'DM_BOPHAN', 'DM_MUCLUONG_DONGBHXH', 'LAIXE_GPLX'],
      buildRelated: (row, tables) => {
        const nhanSuRows = findRowsByIds(tables.NHANSU, 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy]);
        const chucDanhRows = findRowsByIds(tables.DM_CHUCDANH, 'ID_ChucDanh', [
          row.Ref_BoPhan,
          ...nhanSuRows.map((nhanSu) => nhanSu.Ref_ChucDanh)
        ]);
        return {
          NHANSU: nhanSuRows,
          DONVI: tables.DONVI || [],
          DM_CHUCDANH: chucDanhRows,
          DM_BOPHAN: findRowsByIds(tables.DM_BOPHAN, 'ID_BoPhan', [
            row.Ref_BoPhan,
            ...chucDanhRows.map((chucDanh) => chucDanh.Ref_BoPhan)
          ]),
          DM_MUCLUONG_DONGBHXH: findRowsByIds(tables.DM_MUCLUONG_DONGBHXH, 'ID_MucLuong', [row.MucLuongCoBan]),
          LAIXE_GPLX: findRowsByValue(tables.LAIXE_GPLX, 'Ref_NhanSu', row.Ref_NhanSu)
        };
      }
    })
  },

  'thanh-ly-ky-quy-lai-xe': {
    idKeys: ['ID_ThanhLy', 'idThanhLy'],
    missingIdMessage: 'Thiếu tham số ID_ThanhLy.',
    notFoundPrefix: 'Không tìm thấy biên bản thanh lý ký quỹ với ID_ThanhLy',
    failedMessage: 'Không tải được dữ liệu thanh lý ký quỹ lái xe từ Google Sheets.',
    mainKey: 'ID_ThanhLy',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_KYQUY_THANHLY',
      mainKey: 'ID_ThanhLy',
      tableNames: ['NHANSU_KYQUY_THANHLY', 'NHANSU_KYQUY', 'NHANSU', 'DONVI', 'NHANSU_THANHLY_HOPDONG', 'NHANSU_HOPDONG_LAODONG'],
      buildRelated: (row, tables) => {
        const kyQuyRows = findRowsByIds(tables.NHANSU_KYQUY, 'ID_KyQuy', [row.Ref_KyQuy]);
        const kyQuy = kyQuyRows[0] || null;
        const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
        const thanhLyHopDongRows = findRowsByValue(tables.NHANSU_THANHLY_HOPDONG, 'Ref_NhanSu', nhanSuId);
        const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row.NgayLap);
        return {
          NHANSU_KYQUY: kyQuyRows,
          NHANSU: findRowsByIds(tables.NHANSU, 'ID_NhanSu', [nhanSuId]),
          DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [getDonViRefId(kyQuy)]),
          NHANSU_THANHLY_HOPDONG: thanhLyHopDongRows,
          NHANSU_HOPDONG_LAODONG: findRowsByIds(tables.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong', [thanhLyHopDong?.Ref_HopDongLD])
        };
      }
    })
  },

  'cham-dut-hop-dong-lao-dong': {
    idKeys: ['ID_ChamDutHD', 'idChamDutHD'],
    missingIdMessage: 'Thiếu tham số ID_ChamDutHD.',
    notFoundPrefix: 'Không tìm thấy quyết định chấm dứt HĐLĐ với ID_ChamDutHD',
    failedMessage: 'Không tải được dữ liệu chấm dứt HĐLĐ từ Google Sheets.',
    mainKey: 'ID_ChamDutHD',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_CHAMDUT_HOPDONG',
      mainKey: 'ID_ChamDutHD',
      tableNames: ['NHANSU_CHAMDUT_HOPDONG', 'NHANSU_HOPDONG_LAODONG', 'NHANSU', 'DONVI', 'DM_CHUCDANH', 'DM_BOPHAN'],
      buildRelated: (row, tables) => {
        const hopDongRows = findRowsByIds(tables.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong', [row.Ref_HopDongLD]);
        const nhanSuRows = findRowsByIds(tables.NHANSU, 'ID_NhanSu', [row.Ref_NhanSu, row.Ref_NguoiKy]);
        const hopDong = hopDongRows[0] || null;
        const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
        const nguoiKy = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NguoiKy));
        const donViId = cleanValue(hopDong?.Ref_DonViLamViec) || cleanValue(nhanSu?.Ref_DonViLamViecHienTai) || cleanValue(nhanSu?.Ref_DonViChuQuan);
        const chucDanhRows = findRowsByIds(tables.DM_CHUCDANH, 'ID_ChucDanh', [
          nhanSu?.Ref_ChucDanh,
          nguoiKy?.Ref_ChucDanh,
          hopDong?.Ref_BoPhan,
          nhanSu?.Ref_BoPhan
        ]);
        return {
          NHANSU_HOPDONG_LAODONG: hopDongRows,
          NHANSU: nhanSuRows,
          DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [donViId]),
          DM_CHUCDANH: chucDanhRows,
          DM_BOPHAN: findRowsByIds(tables.DM_BOPHAN, 'ID_BoPhan', [
            nhanSu?.Ref_BoPhan,
            hopDong?.Ref_BoPhan,
            ...chucDanhRows.map((item) => item.Ref_BoPhan)
          ])
        };
      }
    })
  },

  'thanh-ly-hop-dong-lao-dong': {
    idKeys: ['ID_ThanhLyHD', 'idThanhLyHD'],
    missingIdMessage: 'Thiếu tham số ID_ThanhLyHD.',
    notFoundPrefix: 'Không tìm thấy biên bản thanh lý HĐLĐ với ID_ThanhLyHD',
    failedMessage: 'Không tải được dữ liệu thanh lý HĐLĐ từ Google Sheets.',
    mainKey: 'ID_ThanhLyHD',
    build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
      id,
      includeRelated,
      providedRow,
      env,
      mainTable: 'NHANSU_THANHLY_HOPDONG',
      mainKey: 'ID_ThanhLyHD',
      tableNames: ['NHANSU_THANHLY_HOPDONG', 'NHANSU', 'NHANSU_HOPDONG_LAODONG', 'NHANSU_CHAMDUT_HOPDONG', 'DONVI'],
      buildRelated: (row, tables) => {
        const nhanSuRows = findRowsByIds(tables.NHANSU, 'ID_NhanSu', [row.Ref_NhanSu]);
        const hopDongRows = findRowsByIds(tables.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong', [row.Ref_HopDongLD]);
        const chamDutRows = findRowsByIds(tables.NHANSU_CHAMDUT_HOPDONG, 'ID_ChamDutHD', [row.Ref_ChamDutHD]);
        const nhanSu = nhanSuRows.find((item) => cleanValue(item.ID_NhanSu) === cleanValue(row.Ref_NhanSu));
        const hopDong = hopDongRows.find((item) => cleanValue(item.ID_HopDongLaoDong) === cleanValue(row.Ref_HopDongLD));
        const donViId = cleanValue(hopDong?.Ref_DonViLamViec) || cleanValue(nhanSu?.Ref_DonViLamViecHienTai) || cleanValue(nhanSu?.Ref_DonViChuQuan);
        return {
          NHANSU_THANHLY_HOPDONG: [row],
          NHANSU: nhanSuRows,
          NHANSU_HOPDONG_LAODONG: hopDongRows,
          NHANSU_CHAMDUT_HOPDONG: chamDutRows,
          DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [donViId])
        };
      }
    })
  }
};

featureConfigs['thoa-thuan-dan-su'] = {
  idKeys: ['ID_TTDS', 'idTtds'],
  missingIdMessage: 'Thiếu tham số ID_TTDS.',
  notFoundPrefix: 'Không tìm thấy thỏa thuận trách nhiệm dân sự với ID_TTDS',
  failedMessage: 'Không tải được dữ liệu thỏa thuận trách nhiệm dân sự từ Google Sheets.',
  mainKey: 'ID_TTDS',
  build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
    id,
    includeRelated,
    providedRow,
    env,
    mainTable: 'XE_THOATHUAN_DANSU',
    mainKey: 'ID_TTDS',
    tableNames: ['XE_THOATHUAN_DANSU', 'DONVI', 'NHANSU', 'XE', 'LAIXE_GPLX'],
    buildRelated: (row, tables) => ({
      XE_THOATHUAN_DANSU: [row],
      DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [row.Ref_DonViBenA]),
      NHANSU: findRowsByIds(tables.NHANSU, 'ID_NhanSu', [row.Ref_LaiXe]),
      XE: findRowsByIds(tables.XE, 'ID_Xe', [row.Ref_Xe]),
      LAIXE_GPLX: findRowsByValue(tables.LAIXE_GPLX, 'Ref_NhanSu', row.Ref_LaiXe)
    })
  })
};

featureConfigs['de-nghi-cap-phu-hieu-xe'] = {
  idKeys: ['ID_HoSoPhuHieu', 'idHoSoPhuHieu'],
  missingIdMessage: 'Thiếu tham số ID_HoSoPhuHieu.',
  notFoundPrefix: 'Không tìm thấy hồ sơ đề nghị cấp phù hiệu với ID_HoSoPhuHieu',
  failedMessage: 'Không tải được dữ liệu đề nghị cấp phù hiệu xe từ Google Sheets.',
  mainKey: 'ID_HoSoPhuHieu',
  build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
    id,
    includeRelated,
    providedRow,
    env,
    mainTable: 'HS_DE_NGHI_PHUHIEU',
    mainKey: 'ID_HoSoPhuHieu',
    tableNames: ['HS_DE_NGHI_PHUHIEU', 'CT_HS_DE_NGHI_PHUHIEU', 'DONVI', 'DM_COQUAN_CAP', 'XE'],
    buildRelated: (row, tables) => {
      const chiTietRows = findRowsByValue(tables.CT_HS_DE_NGHI_PHUHIEU, 'Ref_HoSoPhuHieu', row.ID_HoSoPhuHieu);
      return {
        HS_DE_NGHI_PHUHIEU: [row],
        CT_HS_DE_NGHI_PHUHIEU: chiTietRows,
        DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [row.Ref_DonViDeNghi]),
        DM_COQUAN_CAP: findRowsByIds(tables.DM_COQUAN_CAP, 'ID_CoQuanCap', [row.Ref_CoQuanCap]),
        XE: findRowsByIds(tables.XE, 'ID_Xe', chiTietRows.map((item) => item.Ref_Xe))
      };
    }
  })
};

featureConfigs['thong-bao-ngung-phu-hieu'] = {
  idKeys: ['ID_ThongBaoNgung', 'idThongBaoNgung'],
  missingIdMessage: 'Thiếu tham số ID_ThongBaoNgung.',
  notFoundPrefix: 'Không tìm thấy thông báo ngừng phù hiệu với ID_ThongBaoNgung',
  failedMessage: 'Không tải được dữ liệu thông báo ngừng phù hiệu từ Google Sheets.',
  mainKey: 'ID_ThongBaoNgung',
  build: ({ id, includeRelated, providedRow, env }) => buildSimpleBundle({
    id,
    includeRelated,
    providedRow,
    env,
    mainTable: 'XE_THONGBAO_NGUNG',
    mainKey: 'ID_ThongBaoNgung',
    tableNames: ['XE_THONGBAO_NGUNG', 'XE_THONGBAO_NGUNG_CHITIET', 'DONVI', 'XE', 'XE_PHUHIEU'],
    buildRelated: (row, tables) => {
      const chiTietRows = findRowsByValue(tables.XE_THONGBAO_NGUNG_CHITIET, 'Ref_ThongBaoNgung', row.ID_ThongBaoNgung);
      return {
        XE_THONGBAO_NGUNG: [row],
        XE_THONGBAO_NGUNG_CHITIET: chiTietRows,
        DONVI: findRowsByIds(tables.DONVI, 'ID_DonVi', [row.Ref_DonVi]),
        XE: findRowsByIds(tables.XE, 'ID_Xe', chiTietRows.map((item) => item.Ref_Xe)),
        XE_PHUHIEU: findRowsByIds(tables.XE_PHUHIEU, 'ID_PhuHieu', chiTietRows.map((item) => item.Ref_PhuHieu))
      };
    }
  })
};

featureConfigs['de-nghi-the-chap'] = {
  idKeys: ['ID_HoSoTheChap', 'idHoSoTheChap'],
  missingIdMessage: 'Thiếu tham số ID_HoSoTheChap.',
  notFoundPrefix: 'Không tìm thấy hồ sơ đề nghị thế chấp với ID_HoSoTheChap',
  failedMessage: 'Không tải được dữ liệu đề nghị thế chấp từ Google Sheets.',
  mainKey: 'ID_HoSoTheChap',
  build: async ({ id, includeRelated, providedRow, body, query, env }) => {
    const firstTables = await readTables(['XE_THECHAP_HOSO', 'XE_THECHAP_HOSO_CHITIET'], env);
    const row = providedRow || findRowById(firstTables.XE_THECHAP_HOSO, 'ID_HoSoTheChap', id);
    if (!row) return null;
    if (!includeRelated) return { row, related: {} };

    const includeVisibleRefs = cleanValue(query.includeVisibleRefs || body.includeVisibleRefs || '1') !== '0';
    const includeHiddenRefs = cleanValue(query.includeHiddenRefs || body.includeHiddenRefs || '1') !== '0';
    const includeBankRefs = cleanValue(query.includeBankRefs || body.includeBankRefs || '1') !== '0';
    const includeLoanStatusRefs = cleanValue(query.includeLoanStatusRefs || body.includeLoanStatusRefs || (includeHiddenRefs ? '1' : '0')) !== '0';
    const includeOwnerRefs = cleanValue(query.includeOwnerRefs || body.includeOwnerRefs || (includeHiddenRefs ? '1' : '0')) !== '0';
    const chiTietRows = Array.isArray(body.chiTietRows)
      ? body.chiTietRows
      : findRowsByValue(firstTables.XE_THECHAP_HOSO_CHITIET, 'Ref_HoSoTheChap', row.ID_HoSoTheChap);

    if (!includeVisibleRefs) {
      return {
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
      };
    }

    const refTables = await readTables([
      'XE',
      ...(includeBankRefs ? ['DM_NGANHANG'] : []),
      ...(includeLoanStatusRefs ? ['XE_THECHAP_NGANHANG'] : []),
      ...(includeOwnerRefs ? ['DONVI', 'NHANSU'] : [])
    ], env);
    const xeIds = chiTietRows.map((item) => item.Ref_Xe);
    const xeRows = findRowsByIds(refTables.XE, 'ID_Xe', xeIds);

    return {
      row,
      related: {
        XE_THECHAP_HOSO: [row],
        XE_THECHAP_HOSO_CHITIET: chiTietRows,
        XE_THECHAP_NGANHANG: includeLoanStatusRefs
          ? findRowsByIds(refTables.XE_THECHAP_NGANHANG, 'ID_TheChap', chiTietRows.map((item) => item.Ref_XeTheChapNganHang))
          : [],
        DM_NGANHANG: includeBankRefs
          ? findRowsByIds(refTables.DM_NGANHANG, 'ID_NganHang', [row.Ref_NganHang, ...chiTietRows.map((item) => item.Ref_NganHangMoi)])
          : [],
        XE: xeRows,
        DONVI: includeOwnerRefs ? findRowsByIds(refTables.DONVI, 'ID_DonVi', getXeDonViIds(xeRows)) : [],
        NHANSU: includeOwnerRefs ? findRowsByIds(refTables.NHANSU, 'Ref_XeHienTai', xeIds) : []
      }
    };
  }
};

featureConfigs['thong-ke-phu-hieu-don-vi'] = {
  idKeys: [],
  missingIdMessage: '',
  notFoundPrefix: '',
  failedMessage: 'Không tải được dữ liệu thống kê phù hiệu từ Google Sheets.',
  mainKey: '',
  build: async ({ env }) => {
    const tables = await readTables(['PHUHIEUXE', 'THONGTINDONVIVANTAI'], env);
    return {
      row: {},
      related: {
        PHUHIEUXE: findRowsByValue(tables.PHUHIEUXE, 'TrangThai', 'Hiệu lực'),
        THONGTINDONVIVANTAI: tables.THONGTINDONVIVANTAI || []
      }
    };
  }
};

featureConfigs['quyet-dinh-thu-hoi-gpkd'] = {
  idKeys: ['IDQuyetDinh', 'ID_QD', 'decisionId'],
  missingIdMessage: 'Thiếu tham số IDQuyetDinh.',
  notFoundPrefix: 'Không tìm thấy quyết định với IDQuyetDinh',
  failedMessage: 'Không tải được dữ liệu quyết định thu hồi GPKD từ Google Sheets.',
  mainKey: 'ID_QD',
  build: async ({ id, env }) => {
    const tables = await readTables(['QUYETDINH_THUHOI_GPKD', 'GPKD_THUHOI_CHITIET', 'ThongTin', 'CANCU_PHAPLY', 'NguoiPhuTrach'], env);
    const row = findRowById(tables.QUYETDINH_THUHOI_GPKD, 'ID_QD', id);
    if (!row) return null;
    return {
      row,
      related: {
        QUYETDINH_THUHOI_GPKD: [row],
        GPKD_THUHOI_CHITIET: findRowsByValue(tables.GPKD_THUHOI_CHITIET, 'Ref_QDThuHoi', id),
        ThongTin: tables.ThongTin || [],
        CANCU_PHAPLY: tables.CANCU_PHAPLY || [],
        NguoiPhuTrach: findRowsByIds(tables.NguoiPhuTrach, 'IDNguoi', [row.NguoiKy])
      }
    };
  }
};

function getFeatureConfig(slug) {
  return featureConfigs[slug] || null;
}

function getIdFromRequest(config, query = {}, body = {}) {
  for (const key of config.idKeys || []) {
    const value = cleanValue(query[key] || body[key]);
    if (value) return value;
  }
  return '';
}

async function buildGoogleFeatureBundle(slug, { id = '', includeRelated = true, providedRow = null, body = {}, query = {}, env = process.env } = {}) {
  const config = getFeatureConfig(slug);
  if (!config) {
    throw new Error(`Chưa cấu hình Google Sheets bundle cho endpoint ${slug}.`);
  }

  const bundle = await config.build({ id, includeRelated, providedRow, body, query, env });
  return bundle ? { ...bundle, source: 'google-sheets' } : null;
}

module.exports = {
  buildGoogleFeatureBundle,
  buildMap,
  cleanValue,
  featureConfigs,
  getFeatureConfig,
  getIdFromRequest,
  uniqueValues
};
