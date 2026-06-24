const { cleanValue, readGoogleSheetTables } = require('./google-sheets-service.cjs');

const WARNING_DAYS = 30;

const VEHICLE_PROFILE_TABLES = [
  'XE',
  'BC_XE_TONGHOP',
  'DONVI',
  'DM_DOIXE',
  'DM_DOIXE_MOI',
  'DM_COQUAN_CAP',
  'XE_PHUHIEU',
  'XE_DANGKIEM',
  'XE_BAOHIEM',
  'DM_CTY_BAOHIEM',
  'XE_TAXIMET',
  'DM_CQKD_TAXIMET',
  'XE_THECHAP_NGANHANG',
  'DM_NGANHANG',
  'XE_LICHSU_NGUNG_HOATDONG',
  'XE_SO_KM_THANG',
  'XE_BAODUONG_SUACHUA',
  'DM_NOIDUNG_BD_SC',
  'DM_DONVI_SUACHUA',
  'LAIXE_PHANCONG_XE',
  'NHANSU',
  'LAIXE_GPLX',
  'NHANSU_SUCKHOE',
  'NHANSU_HOPDONG_LAODONG',
  'LAIXE_DAOTAO',
  'NHANSU_BHXH'
];

function uniqueValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanValue).filter(Boolean))];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function readVehicleProfileTables(tableNames, env) {
  const profileEnv = {
    ...env,
    GOOGLE_SHEETS_DEFAULT_RANGE: env.GOOGLE_SHEETS_DEFAULT_RANGE || 'A:ZZ'
  };
  const tables = {};
  const missingSources = [];

  for (const chunk of chunkArray(tableNames, 4)) {
    try {
      Object.assign(tables, await readGoogleSheetTables(chunk, profileEnv));
    } catch (chunkError) {
      for (const tableName of chunk) {
        try {
          Object.assign(tables, await readGoogleSheetTables([tableName], profileEnv));
        } catch (tableError) {
          tables[tableName] = [];
          missingSources.push({
            table: tableName,
            message: tableError.message || chunkError.message || 'Không đọc được bảng Google Sheets.'
          });
        }
      }
    }
  }

  return { tables, missingSources: normalizeDoiXeMissingSources(tables, missingSources) };
}

function normalizeDoiXeMissingSources(tables, missingSources) {
  const hasOld = Array.isArray(tables.DM_DOIXE) && tables.DM_DOIXE.length > 0;
  const hasNew = Array.isArray(tables.DM_DOIXE_MOI) && tables.DM_DOIXE_MOI.length > 0;
  if (!hasOld && !hasNew) return missingSources;
  return missingSources.filter((item) => item.table !== 'DM_DOIXE' && item.table !== 'DM_DOIXE_MOI');
}

function normalizeText(value) {
  return cleanValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanValue(value)
    .replace(/\s+/g, '')
    .replace(/[.\-_/]/g, '')
    .toUpperCase();
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = cleanValue(value);
  if (!text) return null;

  const dateTimeMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (dateTimeMatch) {
    const day = Number(dateTimeMatch[1]);
    const month = Number(dateTimeMatch[2]);
    const year = Number(dateTimeMatch[3]);
    const hour = Number(dateTimeMatch[4] || 0);
    const minute = Number(dateTimeMatch[5] || 0);
    const date = new Date(year, month - 1, day, hour, minute);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateTime(value) {
  const date = parseDateValue(value);
  return date ? date.getTime() : 0;
}

function maxDateTime(row, fields) {
  return Math.max(0, ...(Array.isArray(fields) ? fields : []).map((field) => getDateTime(row?.[field])));
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatDateTime(value) {
  const date = parseDateValue(value) || new Date();
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function yearOf(value) {
  const date = parseDateValue(value);
  return date ? date.getFullYear() : 0;
}

function monthOf(value) {
  const date = parseDateValue(value);
  return date ? date.getMonth() + 1 : 0;
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const number = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function valueOrNull(value) {
  return value === null || value === undefined || value === '' ? null : value;
}

function sumNumbers(values) {
  return (Array.isArray(values) ? values : []).reduce((sum, value) => sum + numberValue(value), 0);
}

function lastNumber(values) {
  const arr = Array.isArray(values) ? values : [];
  for (let index = arr.length - 1; index >= 0; index -= 1) {
    if (arr[index] !== null && arr[index] !== undefined && arr[index] !== '') return numberValue(arr[index]);
  }
  return 0;
}

function formatNumberCell(value) {
  if (value === null || value === undefined || value === '') return '';
  return numberValue(value).toLocaleString('vi-VN');
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${numberValue(value).toLocaleString('vi-VN')} đ`;
}

function indexBy(rows, keys) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
      const value = cleanValue(row?.[key]);
      if (value && !map.has(value)) map.set(value, row);
    });
  });
  return map;
}

function indexByNormalized(rows, key) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = normalizeKey(row?.[key]);
    if (value && !map.has(value)) map.set(value, row);
  });
  return map;
}

function groupBy(rows, key) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = cleanValue(row?.[key]);
    if (!value) return;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  });
  return map;
}

function getFirstValue(row, keys) {
  for (const key of keys) {
    const value = cleanValue(row?.[key]);
    if (value) return value;
  }
  return '';
}

function getDisplayName(row, fields, fallback = '') {
  return getFirstValue(row, fields) || cleanValue(fallback);
}

function statusScore(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  if (
    text.includes('dang hieu luc') ||
    text.includes('con hieu luc') ||
    text.includes('dang the chap') ||
    text.includes('dang hoat dong') ||
    text.includes('con du no') ||
    text.includes('da nhap') ||
    text.includes('hoan thanh')
  ) {
    return 3;
  }
  if (text.includes('sap het') || text.includes('canh bao')) return 2;
  if (
    text.includes('het hieu luc') ||
    text.includes('het han') ||
    text.includes('huy') ||
    text.includes('ngung') ||
    text.includes('da tai tuc')
  ) {
    return -1;
  }
  return 1;
}

function pickLatest(rows, dateFields, statusField) {
  const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (candidates.length === 0) return {};

  return candidates
    .slice()
    .sort((left, right) => {
      const statusDiff = statusScore(right?.[statusField]) - statusScore(left?.[statusField]);
      if (statusDiff) return statusDiff;
      const dateDiff = maxDateTime(right, dateFields) - maxDateTime(left, dateFields);
      if (dateDiff) return dateDiff;
      return numberValue(right?._rowNumber) - numberValue(left?._rowNumber);
    })[0] || {};
}

function sortRowsByDatesDesc(rows, fields) {
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((left, right) => maxDateTime(right, fields) - maxDateTime(left, fields));
}

function statusByDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'Đã hết hạn';
  if (diffDays <= WARNING_DAYS) return 'Sắp hết hạn';
  return 'Còn hiệu lực';
}

function warningLevelFromText(value) {
  const text = normalizeText(value);
  if (text.includes('het han') || text.includes('thieu') || text.includes('qua han')) return 'Đỏ';
  if (text.includes('sap') || text.includes('canh bao') || text.includes('chua')) return 'Vàng';
  return 'Thông tin';
}

function buildModel(tables) {
  return {
    tables,
    index: {
      XE: indexBy(tables.XE, 'ID_Xe'),
      XE_BY_BIENSO: indexByNormalized(tables.XE, 'BienSo'),
      BC_XE_BY_ID: indexBy(tables.BC_XE_TONGHOP, 'ID xe'),
      BC_XE_BY_BIENSO: indexByNormalized(tables.BC_XE_TONGHOP, 'Biển số'),
      DONVI: indexBy(tables.DONVI, ['ID_DonVi', 'MaDonVi', 'TenVietTat', 'TenDonVi']),
      DM_DOIXE: indexBy([...(tables.DM_DOIXE || []), ...(tables.DM_DOIXE_MOI || [])], ['ID_DoiXe', 'ID_Doi', 'ID_DM_DOIXE', 'MaDoiXe', 'MaDoi', 'TenDoiXe', 'Display']),
      DM_COQUAN_CAP: indexBy(tables.DM_COQUAN_CAP, 'ID_CoQuanCap'),
      DM_CTY_BAOHIEM: indexBy(tables.DM_CTY_BAOHIEM, ['ID_CongTyBaoHiem', 'MaBaoHiem', 'TenVietTat']),
      DM_NGANHANG: indexBy(tables.DM_NGANHANG, ['ID_NganHang', 'MaNganHang', 'TenNganHang', 'TenVietTat']),
      DM_CQKD_TAXIMET: indexBy(tables.DM_CQKD_TAXIMET, ['ID_CQKD', 'TenDonVI', 'TenDonVi', 'Display']),
      NHANSU: indexBy(tables.NHANSU, 'ID_NhanSu'),
      DM_NOIDUNG_BD_SC: indexBy(tables.DM_NOIDUNG_BD_SC, ['ID_NoiDung', 'MaNoiDung', 'TenNoiDung']),
      DM_DONVI_SUACHUA: indexBy(tables.DM_DONVI_SUACHUA, ['ID_DonViSuaChua', 'TenDonVi', 'Display'])
    },
    byXe: {
      XE_PHUHIEU: groupBy(tables.XE_PHUHIEU, 'Ref_Xe'),
      XE_DANGKIEM: groupBy(tables.XE_DANGKIEM, 'Ref_Xe'),
      XE_BAOHIEM: groupBy(tables.XE_BAOHIEM, 'Ref_Xe'),
      XE_TAXIMET: groupBy(tables.XE_TAXIMET, 'Ref_Xe'),
      XE_THECHAP: groupBy(tables.XE_THECHAP_NGANHANG, 'Ref_Xe'),
      XE_LICHSU_NGUNG_HOATDONG: groupBy(tables.XE_LICHSU_NGUNG_HOATDONG, 'Ref_Xe'),
      XE_SO_KM_THANG: groupBy(tables.XE_SO_KM_THANG, 'Ref_Xe'),
      XE_BAODUONG_SUACHUA: groupBy(tables.XE_BAODUONG_SUACHUA, 'Ref_Xe'),
      LAIXE_PHANCONG_XE: groupBy(tables.LAIXE_PHANCONG_XE, 'Ref_Xe')
    },
    byNhanSu: {
      LAIXE_GPLX: groupBy(tables.LAIXE_GPLX, 'Ref_NhanSu'),
      NHANSU_SUCKHOE: groupBy(tables.NHANSU_SUCKHOE, 'Ref_NhanSu'),
      NHANSU_HOPDONG: groupBy(tables.NHANSU_HOPDONG_LAODONG, 'Ref_NhanSu'),
      LAIXE_DAOTAO: groupBy(tables.LAIXE_DAOTAO, 'Ref_NhanSu'),
      NHANSU_BHXH: groupBy(tables.NHANSU_BHXH, 'Ref_NhanSu')
    }
  };
}

function displayDonVi(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DONVI.get(key);
  return row ? getDisplayName(row, ['TenDonVi', 'TenVietTat', 'MaDonVi', 'Display'], key) : key;
}

function displayDoiXe(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_DOIXE.get(key);
  return row ? getDisplayName(row, ['TenDoiXe', 'TenDoi', 'SoDoiXe', 'MaDoiXe', 'Display'], key) : key;
}

function displayCoQuanCap(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_COQUAN_CAP.get(key);
  return row ? getDisplayName(row, ['TenCoQuanCap', 'Display'], key) : key;
}

function displayCongTyBaoHiem(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_CTY_BAOHIEM.get(key);
  if (!row) return key;
  const shortName = getFirstValue(row, ['TenVietTat', 'MaBaoHiem']);
  const fullName = cleanValue(row.TenCongTyBaoHiem);
  if (shortName && fullName && normalizeText(shortName) !== normalizeText(fullName)) return `${shortName} - ${fullName}`;
  return fullName || shortName || key;
}

function displayNganHang(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_NGANHANG.get(key);
  if (!row) return key;
  const shortName = getFirstValue(row, ['TenVietTat', 'MaNganHang']);
  const fullName = cleanValue(row.TenNganHang);
  const branch = cleanValue(row.ChiNhanh);
  const name = fullName && shortName && normalizeText(fullName) !== normalizeText(shortName)
    ? `${shortName} - ${fullName}`
    : fullName || shortName || key;
  return branch ? `${name} - ${branch}` : name;
}

function displayDonViKiemDinhTaximet(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_CQKD_TAXIMET.get(key);
  return row ? getDisplayName(row, ['TenDonVI', 'TenDonVi', 'Display'], key) : key;
}

function displayNoiDungBDSC(model, ids) {
  if (!ids) return '';
  return cleanValue(ids)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => {
      const row = model.index.DM_NOIDUNG_BD_SC.get(id);
      return row ? getDisplayName(row, ['TenNoiDung', 'MaNoiDung', 'Display'], id) : id;
    })
    .join(', ');
}

function displayDonViSuaChua(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_DONVI_SUACHUA.get(key);
  return row ? getDisplayName(row, ['TenDonVi', 'Display'], key) : key;
}

function displayDiaDiemSuaChua(model, id) {
  const key = cleanValue(id);
  if (!key) return '';
  const row = model.index.DM_DONVI_SUACHUA.get(key);
  if (!row) return key;
  const name = cleanValue(row.TenDonVi);
  const address = cleanValue(row.DiaChi);
  if (name && address) return `${name} - ${address}`;
  return name || address || key;
}

function pickCompanyDonViRow(model, xe) {
  const byOwner = model.index.DONVI.get(cleanValue(xe.Ref_DonViChuQuan));
  if (byOwner) return byOwner;
  const byManager = model.index.DONVI.get(cleanValue(xe.Ref_DonViQuanLyHienTai));
  if (byManager) return byManager;
  return (model.tables.DONVI || [])[0] || null;
}

function getCompanyProfile(model, xe) {
  const donVi = pickCompanyDonViRow(model, xe) || {};
  const taxCode = getFirstValue(donVi, ['MaSoThue', 'SoDangKyKinhDoanh', 'MaDonVi']);
  return {
    idDonVi: cleanValue(donVi.ID_DonVi),
    maDonVi: cleanValue(donVi.MaDonVi),
    tenCongTy: getDisplayName(donVi, ['TenDonVi', 'TenVietTat', 'Display'], 'TAXI 123'),
    diaChi: getFirstValue(donVi, ['DiaChi', 'DiaChiTruSo', 'DiaChiCongTy']),
    soDangKyKinhDoanh: taxCode,
    maSoThue: taxCode,
    soDienThoai: getFirstValue(donVi, ['SoDienThoai', 'DienThoai', 'Phone']),
    email: cleanValue(donVi.Email),
    nguoiDaiDien: cleanValue(donVi.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(donVi.ChucVuNguoiDaiDien)
  };
}

function bdscType(value) {
  const text = normalizeText(value);
  if (text.includes('bao duong')) return 'BD';
  if (text.includes('cai tao')) return 'CT';
  return 'SC';
}

function formatWorkPeriod(startValue, endValue) {
  const start = formatDate(startValue);
  const end = formatDate(endValue);
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || '';
}

function collectByType(items, type, key) {
  return uniqueValues((Array.isArray(items) ? items : []).filter((item) => item.type === type).map((item) => item[key])).join('; ');
}

function appendCell(oldValue, newValue) {
  if (!oldValue) return newValue;
  if (!newValue) return oldValue;
  return `${oldValue}; ${newValue}`;
}

function buildTechnicalData(model, idXe, nam) {
  const year = Number(nam);
  const kmRows = (model.byXe.XE_SO_KM_THANG.get(idXe) || []).filter((row) => Number(row.Nam) === year);
  const byMonth = new Map();
  kmRows.forEach((row) => {
    const month = Number(row.Thang);
    if (month >= 1 && month <= 12) byMonth.set(month, row);
  });

  const kmThangRaw = [];
  const kmLuyKeRaw = [];
  const chuyenThangRaw = [];
  const chuyenLuyKeRaw = [];

  for (let month = 1; month <= 12; month += 1) {
    const row = byMonth.get(month);
    kmThangRaw.push(row ? valueOrNull(row.SoKmHoatDong) : null);
    kmLuyKeRaw.push(row ? valueOrNull(row.LuyKeKmXeChay) : null);
    chuyenThangRaw.push(row ? valueOrNull(row.SoChuyenTrongThang) : null);
    chuyenLuyKeRaw.push(row ? valueOrNull(row.LuyKeSoChuyen) : null);
  }

  const counters = { BD: 0, SC: 0, CT: 0 };
  const bdscAnnotated = (model.byXe.XE_BAODUONG_SUACHUA.get(idXe) || [])
    .filter((row) => yearOf(row.NgayThucHien) === year)
    .sort((left, right) => getDateTime(left.NgayThucHien) - getDateTime(right.NgayThucHien))
    .map((row) => {
      const type = bdscType(row.LoaiPhieu);
      counters[type] = (counters[type] || 0) + 1;
      return {
        source: row,
        type,
        code: `${type}${String(counters[type]).padStart(2, '0')}`,
        month: monthOf(row.NgayThucHien),
        period: formatWorkPeriod(row.NgayThucHien, row.NgayKetThuc),
        place: displayDiaDiemSuaChua(model, row.Ref_DonViSuaChua)
      };
    });

  const baoDuong = new Array(12).fill('');
  const suaChua = new Array(12).fill('');
  const caiTao = new Array(12).fill('');

  bdscAnnotated.forEach((item) => {
    if (item.month < 1 || item.month > 12) return;
    const index = item.month - 1;
    if (item.type === 'BD') baoDuong[index] = appendCell(baoDuong[index], item.code);
    else if (item.type === 'CT') caiTao[index] = appendCell(caiTao[index], item.code);
    else suaChua[index] = appendCell(suaChua[index], item.code);
  });

  const monthRows = [
    { tt: '1', noiDung: 'Km xe chạy trong tháng', values: kmThangRaw.map(formatNumberCell), total: formatNumberCell(sumNumbers(kmThangRaw)), thoiGian: '', diaDiem: '' },
    { tt: '', noiDung: 'Km xe chạy lũy kế', values: kmLuyKeRaw.map(formatNumberCell), total: formatNumberCell(sumNumbers(kmThangRaw)), thoiGian: '', diaDiem: '' },
    { tt: '2', noiDung: 'Số chuyến trong tháng', values: chuyenThangRaw.map(formatNumberCell), total: formatNumberCell(sumNumbers(chuyenThangRaw)), thoiGian: '', diaDiem: '' },
    { tt: '', noiDung: 'Số chuyến xe lũy kế', values: chuyenLuyKeRaw.map(formatNumberCell), total: formatNumberCell(sumNumbers(chuyenThangRaw)), thoiGian: '', diaDiem: '' },
    { tt: '3', noiDung: 'Bảo dưỡng', values: baoDuong, total: bdscAnnotated.filter((item) => item.type === 'BD').length, thoiGian: collectByType(bdscAnnotated, 'BD', 'period'), diaDiem: collectByType(bdscAnnotated, 'BD', 'place') },
    { tt: '4', noiDung: 'Sửa chữa', values: suaChua, total: bdscAnnotated.filter((item) => item.type === 'SC').length, thoiGian: collectByType(bdscAnnotated, 'SC', 'period'), diaDiem: collectByType(bdscAnnotated, 'SC', 'place') },
    { tt: '5', noiDung: 'Cải tạo', values: caiTao, total: bdscAnnotated.filter((item) => item.type === 'CT').length, thoiGian: collectByType(bdscAnnotated, 'CT', 'period'), diaDiem: collectByType(bdscAnnotated, 'CT', 'place') }
  ];

  const bdscRows = bdscAnnotated
    .slice()
    .sort((left, right) => getDateTime(right.source.NgayThucHien) - getDateTime(left.source.NgayThucHien))
    .map((item) => {
      const row = item.source;
      const costNumber = numberValue(row.TongChiPhi);
      return {
        ma: item.code,
        thoiGian: item.period,
        loai: cleanValue(row.LoaiPhieu),
        noiDung: displayNoiDungBDSC(model, row.Ref_NoiDungBaoDuong),
        soKm: formatNumberCell(row.SoKmTaiThoiDiem),
        donVi: displayDonViSuaChua(model, row.Ref_DonViSuaChua),
        diaDiem: item.place,
        chiPhi: formatMoney(row.TongChiPhi),
        chiPhiNumber: costNumber,
        trangThai: cleanValue(row.TrangThaiPhieu),
        ghiChu: cleanValue(row.GhiChu)
      };
    });

  const totalCost = bdscRows.reduce((sum, row) => sum + numberValue(row.chiPhiNumber), 0);
  const totalKmRaw = sumNumbers(kmThangRaw);
  const summary = {
    totalKm: formatNumberCell(totalKmRaw),
    totalKmRaw,
    totalTrips: formatNumberCell(sumNumbers(chuyenThangRaw)),
    lastKm: formatNumberCell(lastNumber(kmLuyKeRaw)),
    lastTrips: formatNumberCell(lastNumber(chuyenLuyKeRaw)),
    totalBD: bdscAnnotated.filter((item) => item.type === 'BD').length,
    totalSC: bdscAnnotated.filter((item) => item.type === 'SC').length,
    totalCT: bdscAnnotated.filter((item) => item.type === 'CT').length,
    totalCost: formatMoney(totalCost)
  };

  return { monthRows, bdscRows, summary };
}

function buildVehicleHistories(model, idXe) {
  const phuHieu = sortRowsByDatesDesc(model.byXe.XE_PHUHIEU.get(idXe), ['NgayCap', 'NgayHetHan', 'NgayTao']).map((row) => ({
    loai: cleanValue(row.LoaiPhuHieu),
    so: cleanValue(row.SoPhuHieu),
    coQuanCap: displayCoQuanCap(model, row.Ref_CoQuanCap) || cleanValue(row.Ref_CoQuanCap),
    donViDuocCap: displayDonVi(model, row.Ref_DonViDuocCap),
    donViQuanLy: displayDonVi(model, row.Ref_DonViQuanLyTaiThoiDiemCap),
    ngayCap: formatDate(row.NgayCap),
    ngayHetHan: formatDate(row.NgayHetHan),
    ngayHetHieuLucThucTe: formatDate(row.NgayHetHieuLucThucTe),
    trangThai: cleanValue(row.TrangThai),
    lyDo: cleanValue(row.LyDoCap || row.LyDoHetHieuLuc),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const dangKiem = sortRowsByDatesDesc(model.byXe.XE_DANGKIEM.get(idXe), ['NgayCap', 'NgayHetHan', 'NgayTao']).map((row) => ({
    so: cleanValue(row.SoDangKiem),
    donVi: cleanValue(row.DonViDangKiem),
    ngayCap: formatDate(row.NgayCap),
    ngayHetHan: formatDate(row.NgayHetHan),
    trangThai: cleanValue(row.TrangThai),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const baoHiem = sortRowsByDatesDesc(model.byXe.XE_BAOHIEM.get(idXe), ['NgayCap', 'NgayHetHan', 'NgayTao']).map((row) => ({
    loai: cleanValue(row.LoaiBaoHiem),
    so: cleanValue(row.SoHopDongBaoHiem),
    congTy: displayCongTyBaoHiem(model, row.Ref_CongTyBaoHiem),
    nguon: cleanValue(row.NguonMuaBaoHiem),
    ngayCap: formatDate(row.NgayCap),
    ngayHetHan: formatDate(row.NgayHetHan),
    giaTri: formatMoney(row.GiaTriBaoHiem),
    trangThai: cleanValue(row.TrangThaiBaoHiem),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const taximet = sortRowsByDatesDesc(model.byXe.XE_TAXIMET.get(idXe), ['NgayKiemDinh', 'NgayHetHanKiemDinh', 'NgayLapDat', 'NgayTao']).map((row) => ({
    so: cleanValue(row.SoThietBi),
    nhaSanXuat: cleanValue(row.NhaSanXuat),
    ngayLapDat: formatDate(row.NgayLapDat),
    ngayKiemDinh: formatDate(row.NgayKiemDinh),
    ngayHetHan: formatDate(row.NgayHetHanKiemDinh),
    donVi: displayDonViKiemDinhTaximet(model, row.Ref_DonViKiemDinh),
    trangThai: cleanValue(row.TrangThai),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const theChap = sortRowsByDatesDesc(model.byXe.XE_THECHAP.get(idXe), ['NgayTheChap', 'NgayHetHan', 'NgayGiaiChap', 'NgayTao']).map((row) => ({
    nganHang: displayNganHang(model, row.Ref_NganHang),
    soHopDong: cleanValue(row.SoHopDongTheChap),
    ngayTheChap: formatDate(row.NgayTheChap),
    ngayHetHan: formatDate(row.NgayHetHan),
    ngayGiaiChap: formatDate(row.NgayGiaiChap),
    soTienVay: formatMoney(row.SoTienVay),
    giaTriTSDB: formatMoney(row.GiaTriTaiSanDamBao),
    hinhThucDamBao: cleanValue(row.HinhThucDamBao),
    tinhTrangHoSoGoc: cleanValue(row.TinhTrangHoSoGoc),
    trangThaiTheChap: cleanValue(row.TrangThaiTheChap),
    trangThaiKhoanVay: cleanValue(row.TrangThaiKhoanVay),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const ngungHoatDong = sortRowsByDatesDesc(model.byXe.XE_LICHSU_NGUNG_HOATDONG.get(idXe), ['NgayBatDauNgung', 'NgayKetThucNgung', 'NgayTao']).map((row) => ({
    tuNgay: formatDate(row.NgayBatDauNgung),
    denNgay: formatDate(row.NgayKetThucNgung),
    lyDo: cleanValue(row.LyDoNgung),
    trangThaiTruoc: cleanValue(row.TrangThaiTruocNgung),
    trangThaiSau: cleanValue(row.TrangThaiSauNgung),
    thongBao: cleanValue(row.Ref_ThongBaoNgung),
    ghiChu: cleanValue(row.GhiChu)
  }));

  const laiXe = sortRowsByDatesDesc(model.byXe.LAIXE_PHANCONG_XE.get(idXe), ['NgayBatDau', 'NgayKetThuc', 'NgayTao']).map((row) => {
    const nhanSu = model.index.NHANSU.get(cleanValue(row.Ref_NhanSu)) || {};
    return {
      hoTen: getDisplayName(nhanSu, ['HoTen', 'Display'], row.Ref_NhanSu),
      cccd: cleanValue(nhanSu.CCCD),
      soDienThoai: cleanValue(nhanSu.SoDienThoai),
      donViLamViec: displayDonVi(model, row.Ref_DonViLamViecHienTai),
      tuNgay: formatDate(row.NgayBatDau),
      denNgay: formatDate(row.NgayKetThuc),
      trangThai: cleanValue(row.TrangThai),
      ghiChu: cleanValue(row.GhiChu)
    };
  });

  return { phuHieu, dangKiem, baoHiem, taximet, theChap, ngungHoatDong, laiXe };
}

function buildWarnings(legalRows, summary, driver, technical) {
  const warnings = [];

  legalRows.forEach((row) => {
    const status = normalizeText(row.trangThai);
    const name = cleanValue(row.loai);
    if (!row.ngayHetHan && name !== 'Thế chấp ngân hàng') {
      warnings.push({ level: 'Đỏ', content: `Chưa có hoặc thiếu thông tin ${name}`, note: 'Cần rà soát hồ sơ pháp lý' });
      return;
    }
    if (status.includes('het han') || status.includes('da het')) {
      warnings.push({ level: 'Đỏ', content: `${name} đã hết hạn`, note: 'Cần xử lý ngay' });
    } else if (status.includes('sap het')) {
      warnings.push({ level: 'Vàng', content: `${name} sắp hết hạn`, note: 'Theo dõi gia hạn' });
    }
  });

  if (!driver.hoTen) {
    warnings.push({ level: 'Vàng', content: 'Xe chưa có lái xe đang phân công', note: 'Cần kiểm tra bảng LAIXE_PHANCONG_XE' });
  }

  const note = cleanValue(summary['Ghi chú cảnh báo']);
  if (note) {
    warnings.push({ level: warningLevelFromText(note), content: note, note: 'Nguồn: BC_XE_TONGHOP' });
  }

  if (!technical.summary.totalKmRaw) {
    warnings.push({ level: 'Vàng', content: 'Chưa có dữ liệu km hoạt động trong năm', note: 'Kiểm tra bảng XE_SO_KM_THANG' });
  }

  if (warnings.length === 0) {
    warnings.push({ level: 'Xanh', content: 'Hồ sơ xe chưa phát hiện cảnh báo lớn', note: 'Tiếp tục theo dõi định kỳ' });
  }

  return warnings;
}

function buildVehicleProfileData(model, xe, nam, missingSources = [], availableYears = []) {
  const idXe = cleanValue(xe.ID_Xe);
  const bienSo = cleanValue(xe.BienSo);
  const summary = model.index.BC_XE_BY_ID.get(idXe) || model.index.BC_XE_BY_BIENSO.get(normalizeKey(bienSo)) || {};
  const donViChuQuan = displayDonVi(model, xe.Ref_DonViChuQuan);
  const donViQuanLy = displayDonVi(model, xe.Ref_DonViQuanLyHienTai);
  const doiXe = displayDoiXe(model, xe.Ref_DoiXe);

  const phuHieu = pickLatest(model.byXe.XE_PHUHIEU.get(idXe), ['NgayHetHan', 'NgayCap'], 'TrangThai');
  const dangKiem = pickLatest(model.byXe.XE_DANGKIEM.get(idXe), ['NgayHetHan', 'NgayCap'], 'TrangThai');
  const taximet = pickLatest(model.byXe.XE_TAXIMET.get(idXe), ['NgayHetHanKiemDinh', 'NgayKiemDinh'], 'TrangThai');
  const baoHiemRows = model.byXe.XE_BAOHIEM.get(idXe) || [];
  const bhTNDS = pickLatest(baoHiemRows.filter((row) => normalizeText(row.LoaiBaoHiem).includes('tnds')), ['NgayHetHan', 'NgayCap'], 'TrangThaiBaoHiem');
  const bhThanVo = pickLatest(baoHiemRows.filter((row) => {
    const text = normalizeText(row.LoaiBaoHiem);
    return text.includes('than vo') || text.includes('vat chat') || text.includes('bhtv');
  }), ['NgayHetHan', 'NgayCap'], 'TrangThaiBaoHiem');
  const theChap = pickLatest(model.byXe.XE_THECHAP.get(idXe), ['NgayHetHan', 'NgayTheChap'], 'TrangThaiTheChap');
  const phanCong = pickLatest((model.byXe.LAIXE_PHANCONG_XE.get(idXe) || []).filter((row) => {
    const text = normalizeText(row.TrangThai);
    return !text || text.includes('dang hieu luc') || text.includes('hieu luc') || text.includes('dang phan cong');
  }), ['NgayBatDau', 'NgayTao'], 'TrangThai');
  const nhanSu = phanCong.Ref_NhanSu ? model.index.NHANSU.get(cleanValue(phanCong.Ref_NhanSu)) || {} : {};
  const nhanSuId = cleanValue(nhanSu.ID_NhanSu);
  const gplx = pickLatest(model.byNhanSu.LAIXE_GPLX.get(nhanSuId), ['NgayHetHan', 'NgayCap'], 'TrangThai');
  const sucKhoe = pickLatest(model.byNhanSu.NHANSU_SUCKHOE.get(nhanSuId), ['NgayHetHan', 'NgayKham'], 'TrangThai');
  const hopDong = pickLatest(model.byNhanSu.NHANSU_HOPDONG.get(nhanSuId), ['NgayKetThuc', 'NgayBatDau', 'NgayKy'], 'TrangThai');
  const daoTao = pickLatest(model.byNhanSu.LAIXE_DAOTAO.get(nhanSuId), ['NgayHetHan', 'NgayCapChungChi'], 'TrangThai');
  const bhxh = pickLatest(model.byNhanSu.NHANSU_BHXH.get(nhanSuId), ['NgayKetThucThamGia', 'NgayBatDauThamGia'], 'TrangThaiBHXH');

  const legalRows = [
    { loai: 'Đăng kiểm', so: cleanValue(dangKiem.SoDangKiem), donVi: cleanValue(dangKiem.DonViDangKiem), ngayCap: formatDate(dangKiem.NgayCap), ngayHetHan: formatDate(dangKiem.NgayHetHan || summary['Hạn đăng kiểm']), trangThai: cleanValue(dangKiem.TrangThai) || statusByDate(dangKiem.NgayHetHan || summary['Hạn đăng kiểm']), file: cleanValue(dangKiem.FileScan) },
    { loai: 'Phù hiệu', so: cleanValue(phuHieu.SoPhuHieu || summary['Số phù hiệu']), donVi: displayCoQuanCap(model, phuHieu.Ref_CoQuanCap) || cleanValue(phuHieu.CoQuanCap || phuHieu.Ref_CoQuanCap), ngayCap: formatDate(phuHieu.NgayCap), ngayHetHan: formatDate(phuHieu.NgayHetHan || summary['Hạn phù hiệu']), trangThai: cleanValue(phuHieu.TrangThai) || statusByDate(phuHieu.NgayHetHan || summary['Hạn phù hiệu']), file: cleanValue(phuHieu.FileScan) },
    { loai: 'Bảo hiểm TNDS', so: cleanValue(bhTNDS.SoHopDongBaoHiem), donVi: displayCongTyBaoHiem(model, bhTNDS.Ref_CongTyBaoHiem) || cleanValue(summary['Công ty BNTNDS'] || bhTNDS.NguonMuaBaoHiem), ngayCap: formatDate(bhTNDS.NgayCap), ngayHetHan: formatDate(bhTNDS.NgayHetHan || summary['Hạn bảo hiểm TNDS']), trangThai: cleanValue(bhTNDS.TrangThaiBaoHiem) || statusByDate(bhTNDS.NgayHetHan || summary['Hạn bảo hiểm TNDS']), file: cleanValue(bhTNDS.FileBaoHiem) },
    { loai: 'Bảo hiểm thân vỏ', so: cleanValue(bhThanVo.SoHopDongBaoHiem), donVi: displayCongTyBaoHiem(model, bhThanVo.Ref_CongTyBaoHiem) || cleanValue(summary['Công ty BHTV'] || bhThanVo.NguonMuaBaoHiem), ngayCap: formatDate(bhThanVo.NgayCap), ngayHetHan: formatDate(bhThanVo.NgayHetHan || summary['Hạn bảo hiểm thân vỏ']), trangThai: cleanValue(bhThanVo.TrangThaiBaoHiem) || statusByDate(bhThanVo.NgayHetHan || summary['Hạn bảo hiểm thân vỏ']), file: cleanValue(bhThanVo.FileBaoHiem) },
    { loai: 'Taximet', so: cleanValue(taximet.SoThietBi), donVi: displayDonViKiemDinhTaximet(model, taximet.Ref_DonViKiemDinh) || cleanValue(taximet.DonViKiemDinh), ngayCap: formatDate(taximet.NgayKiemDinh), ngayHetHan: formatDate(taximet.NgayHetHanKiemDinh || summary['Hạn taximet']), trangThai: cleanValue(taximet.TrangThai) || statusByDate(taximet.NgayHetHanKiemDinh || summary['Hạn taximet']), file: cleanValue(taximet.FileScan) },
    { loai: 'Thế chấp ngân hàng', so: cleanValue(theChap.SoHopDongTheChap), donVi: displayNganHang(model, theChap.Ref_NganHang) || cleanValue(summary['Ngân hàng thế chấp']), ngayCap: formatDate(theChap.NgayTheChap), ngayHetHan: formatDate(theChap.NgayHetHan || summary['Hạn thế chấp']), trangThai: [cleanValue(theChap.TrangThaiTheChap || summary['Có thế chấp không']), cleanValue(theChap.TrangThaiKhoanVay || summary['Trạng thái khoản vay'])].filter(Boolean).join(' - '), file: cleanValue(theChap.FileHopDongTheChap) }
  ];

  const driver = {
    hoTen: getDisplayName(nhanSu, ['HoTen', 'Display'], summary['Lái xe đang lái']),
    cccd: cleanValue(nhanSu.CCCD),
    soDienThoai: cleanValue(nhanSu.SoDienThoai),
    ngaySinh: formatDate(nhanSu.NgaySinh),
    ngayBatDau: formatDate(phanCong.NgayBatDau),
    trangThaiPhanCong: cleanValue(phanCong.TrangThai),
    soGPLX: cleanValue(gplx.SoGPLX),
    hangGPLX: cleanValue(gplx.HangGPLX),
    hanGPLX: formatDate(gplx.NgayHetHan),
    hanSucKhoe: formatDate(sucKhoe.NgayHetHan),
    hopDong: cleanValue(hopDong.SoHopDong),
    trangThaiHopDong: cleanValue(hopDong.TrangThai),
    daoTao: cleanValue(daoTao.NoiDungDaoTao),
    hanDaoTao: formatDate(daoTao.NgayHetHan),
    bhxh: cleanValue(bhxh.TrangThaiBHXH)
  };

  const technical = buildTechnicalData(model, idXe, nam);
  const histories = buildVehicleHistories(model, idXe);
  const company = getCompanyProfile(model, xe);
  const warnings = buildWarnings(legalRows, summary, driver, technical);
  missingSources.forEach((source) => {
    warnings.push({
      level: 'Thông tin',
      content: `Chưa đọc được bảng ${source.table}`,
      note: source.message || 'Nguồn dữ liệu phụ chưa sẵn sàng'
    });
  });

  return {
    meta: {
      title: 'HỒ SƠ LÝ LỊCH PHƯƠNG TIỆN',
      appName: 'QLVT_TAXI123_HN',
      brand: 'TAXI 123',
      year: Number(nam),
      availableYears,
      printDate: formatDateTime(new Date()),
      companyName: company.tenCongTy,
      diaChiCongTy: company.diaChi,
      soDangKyKinhDoanh: company.soDangKyKinhDoanh,
      maSoThue: company.maSoThue,
      soDienThoai: company.soDienThoai
    },
    company,
    vehicle: {
      idXe,
      bienSo,
      maDam: cleanValue(xe.MaDam || summary['Mã đàm']),
      tenDangKyXe: cleanValue(xe.TenDangKyXe || summary['Tên đăng ký xe']),
      soKhung: cleanValue(xe.SoKhung || summary['Số khung']),
      soMay: cleanValue(xe.SoMay || summary['Số máy']),
      nhanHieu: cleanValue(xe.NhanHieu || summary['Nhãn hiệu']),
      loaiXe: cleanValue(xe.LoaiXe || summary['Loại xe']),
      soCho: cleanValue(xe.SoCho || summary['Số chỗ']),
      taiTrong: cleanValue(xe.TaiTrong),
      nuocSX: cleanValue(xe.NuocSX),
      namSanXuat: cleanValue(xe.NamSanXuat || summary['Năm SX']),
      mauSon: cleanValue(xe.MauSon),
      soDangKy: cleanValue(xe.SoGCNDangKyXe || summary['Số đăng ký']),
      ngayDangKyXeLanDau: formatDate(xe.NgayDangKyXeLanDau),
      ngayDuaVaoHoatDong: formatDate(xe.NgayDuaVaoHoatDong || xe.NgayDuaVaoHD),
      trangThaiXe: cleanValue(xe.TrangThaiXe),
      donViChuQuan,
      donViQuanLy,
      donViQuanLyHienTai: donViQuanLy,
      doiXe,
      diaChiDonVi: company.diaChi,
      dienThoaiDonVi: company.soDienThoai
    },
    driver,
    legalRows,
    monthRows: technical.monthRows,
    bdscRows: technical.bdscRows,
    technicalSummary: technical.summary,
    histories,
    warnings,
    missingSources
  };
}

async function buildVehicleProfileBundle({ id, query = {}, env = process.env } = {}) {
  const { tables, missingSources } = await readVehicleProfileTables(VEHICLE_PROFILE_TABLES, env);
  const model = buildModel(tables);
  const row = model.index.XE.get(cleanValue(id)) || model.index.XE_BY_BIENSO.get(normalizeKey(id));
  if (!row) return null;
  const idXe = cleanValue(row.ID_Xe);
  const yearsWithData = Array.from(new Set(
    (model.byXe.XE_SO_KM_THANG.get(idXe) || [])
      .map((kmRow) => Number(kmRow.Nam))
      .filter((year) => Number.isInteger(year) && year > 0)
  )).sort((a, b) => b - a);
  const requestedYear = Number(query.nam || query.year);
  const nam = requestedYear || yearsWithData[0] || new Date().getFullYear();
  const profile = buildVehicleProfileData(model, row, nam, missingSources, yearsWithData);

  return {
    row,
    related: {
      tables: VEHICLE_PROFILE_TABLES.filter((tableName) => tableName !== 'XE' && Array.isArray(tables[tableName]) && tables[tableName].length > 0)
    },
    profile,
    missingSources
  };
}

module.exports = {
  VEHICLE_PROFILE_TABLES,
  buildVehicleProfileBundle,
  buildVehicleProfileData
};
