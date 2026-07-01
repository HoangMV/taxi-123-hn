const {
  cleanValue,
  findRowById,
  findRowsByIds,
  readGoogleSheetTables
} = require('./google-sheets-service.cjs');
const { buildVehicleProfileBundle } = require('./vehicle-profile-builder.cjs');
const { buildNhanSuProfileBundle } = require('./nhan-su-profile-builder.cjs');

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

function sortDoiXeValues(values) {
  return uniqueValues(values).sort((left, right) => {
    const leftUnknown = left === 'Chưa xác định';
    const rightUnknown = right === 'Chưa xác định';
    if (leftUnknown !== rightUnknown) return leftUnknown ? 1 : -1;

    const leftNumber = Number(cleanValue(left).match(/\d+/)?.[0] || NaN);
    const rightNumber = Number(cleanValue(right).match(/\d+/)?.[0] || NaN);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right, 'vi');
  });
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

const DASHBOARD_WARNING_DAYS = 30;
const DASHBOARD_TABLES = [
  'NHANSU',
  'NHANSU_HOPDONG_LAODONG',
  'NHANSU_BHXH',
  'LAIXE_GPLX',
  'NHANSU_SUCKHOE',
  'LAIXE_DAOTAO',
  'XE_THOATHUAN_DANSU',
  'NHANSU_NGUOITHAN',
  'LAIXE_PHANCONG_XE',
  'LOG_GAN_DOIXE_NHANSU',
  'DONVI',
  'DM_BOPHAN',
  'DM_CHUCDANH',
  'DM_DOIXE',
  'DM_NGANHANG',
  'XE',
  'XE_XUAT_HANG',
  'XE_PHUHIEU',
  'XE_DANGKIEM',
  'XE_BAOHIEM',
  'XE_TAXIMET',
  'XE_THECHAP_NGANHANG',
  'XE_SO_KM_THANG',
  'KIEMTRA_XE_TAXI',
  'KIEMTRA_XE_TAXI_CHITIET',
  'PHAN_ANH_KHIEU_NAI',
  'LAIXE_KHENTHUONG_KYLUAT',
  'LAIXE_VIPHAM_ATGT',
  'LAIXE_VIPHAM_NOIBO'
];

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function readDashboardTables(tableNames, env) {
  const dashboardEnv = {
    ...env,
    GOOGLE_SHEETS_DEFAULT_RANGE: env.GOOGLE_SHEETS_DEFAULT_RANGE || 'A:AZ'
  };
  const tables = {};
  const missingSources = [];

  for (const chunk of chunkArray(tableNames, 4)) {
    try {
      Object.assign(tables, await readTables(chunk, dashboardEnv));
    } catch (chunkError) {
      for (const tableName of chunk) {
        try {
          Object.assign(tables, await readTables([tableName], dashboardEnv));
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

  return { tables, missingSources };
}

function normalizeVietnameseText(value) {
  return cleanValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function valueContains(value, keywords) {
  const text = normalizeVietnameseText(value);
  return (Array.isArray(keywords) ? keywords : [keywords]).some((keyword) => text.includes(normalizeVietnameseText(keyword)));
}

function getFirstValue(row, keys) {
  for (const key of keys) {
    const value = cleanValue(row?.[key]);
    if (value) return value;
  }
  return '';
}

function buildLookupMap(rows, keys) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    keys.forEach((key) => {
      const value = cleanValue(row?.[key]);
      if (value && !map.has(value)) map.set(value, row);
    });
  });
  return map;
}

function groupRowsBy(rows, keyName) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = cleanValue(row?.[keyName]);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function sortRowsByDateDesc(rows, fields) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const dateA = getDateTime(getFirstValue(a, fields));
    const dateB = getDateTime(getFirstValue(b, fields));
    return dateB - dateA;
  });
}

function pickCurrentRow(rows, options = {}) {
  const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (candidates.length === 0) return null;
  const statusFields = options.statusFields || ['TrangThai', 'TrangThaiBHXH', 'TrangThaiBaoHiem', 'TrangThaiXe'];
  const activeKeywords = options.activeKeywords || ['đang hiệu lực', 'hiệu lực', 'đang tham gia', 'đang phân công', 'đang hoạt động'];
  const dateFields = options.dateFields || ['NgayHetHan', 'NgayKetThuc', 'NgayBatDau', 'NgayCap'];
  const activeRows = candidates.filter((row) => statusFields.some((field) => valueContains(row?.[field], activeKeywords)));
  return sortRowsByDateDesc(activeRows.length ? activeRows : candidates, dateFields)[0] || candidates[0];
}

function pickGuarantor(rows) {
  const candidates = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (candidates.length === 0) return null;
  const baoLanh = candidates.find((row) => valueContains(row?.QuanHe, ['nbl', 'bao lanh', 'bảo lãnh']));
  return baoLanh || candidates[0];
}

function formatDashboardDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const monthValue = date.getMonth() + 1;
  const month = monthValue <= 2 ? String(monthValue).padStart(2, '0') : String(monthValue);
  return `${day}/${month}/${date.getFullYear()}`;
}

function getWarningLevel(value, today = new Date()) {
  const date = parseDateValue(value);
  if (!date) return { level: 'xam', label: 'Thiếu dữ liệu', days: null };
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.ceil((target.getTime() - startToday.getTime()) / 86400000);
  if (days < 0) return { level: 'do', label: 'Quá hạn', days };
  if (days <= DASHBOARD_WARNING_DAYS) return { level: 'vang', label: 'Sắp hết hạn', days };
  return { level: 'xanh', label: 'Còn hiệu lực', days };
}

function buildWarningNote(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.level && item.level !== 'xanh')
    .map((item) => `${item.label}: ${item.name}${item.date ? ` (${item.date})` : ''}`)
    .join('; ');
}

function pickActiveWarnings(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.level && item.level !== 'xanh')
    .map((item) => ({ name: item.name, date: item.date || '', level: item.level, label: item.label, days: item.days ?? null }));
}

function countBy(items, keyName) {
  const counts = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = cleanValue(item?.[keyName]) || 'Chưa có dữ liệu';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function getNumberValue(value) {
  const number = Number(cleanValue(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function getDisplayName(row, fields, fallback = '') {
  return getFirstValue(row, fields) || fallback;
}

function isRawRefCode(value) {
  const text = cleanValue(value);
  return /^[A-Z0-9]{6,12}$/i.test(text) && /[A-Z]/i.test(text);
}

function formatDoiXeDisplay(value) {
  const text = cleanValue(value);
  if (!text) return '';
  if (/^\d+$/.test(text)) return `Đội xe ${text}`;
  return text;
}

function buildDoiXeLegacyMap(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const name = cleanValue(row?.TenDoiXe) || cleanValue(row?.Xa_Truoc);
    if (!name) return;
    [row?.Ref_DoiXe_Moi, row?.Ref_DoiXe_Cu].forEach((ref) => {
      const key = cleanValue(ref);
      if (key && !map.has(key)) map.set(key, name);
    });
  });
  return map;
}

function resolveDoiXeDisplay(doiXe, fallback = '', legacyMap = null) {
  const display = getDisplayName(doiXe, ['TenDoiXe', 'TenDoi', 'Ten', 'MaDoiXe', 'Display']);
  if (display) return formatDoiXeDisplay(display);

  const cleanFallback = cleanValue(fallback);
  if (!cleanFallback) return '';
  const legacyDisplay = legacyMap?.get(cleanFallback);
  if (legacyDisplay) return formatDoiXeDisplay(legacyDisplay);
  if (isRawRefCode(cleanFallback)) return 'Chưa xác định';
  return formatDoiXeDisplay(cleanFallback);
}

function buildDoiXeWarning(doiXe, fallback = '', legacyMap = null) {
  const cleanFallback = cleanValue(fallback);
  if (legacyMap?.get(cleanFallback)) return null;
  if (doiXe || !isRawRefCode(cleanFallback)) return null;
  return {
    name: 'Đội xe',
    level: 'xam',
    label: 'Chưa khớp DM_DOIXE',
    date: ''
  };
}

// 10 bảng hồ sơ pháp lý — port từ HOSO_PHUONG_TIEN / HOSO_NHAN_SU của bản .gs.
// scope: đối tượng cần có hồ sơ ('xe' = xe đang hoạt động, 'ns' = nhân sự đang làm).
const HOSO_TABLES = [
  { sheet: 'XE_DANGKIEM', nhom: 'Đăng kiểm', ref: 'Ref_Xe', expiry: 'NgayHetHan', scope: 'xe' },
  { sheet: 'XE_PHUHIEU', nhom: 'Phù hiệu', ref: 'Ref_Xe', expiry: 'NgayHetHan', scope: 'xe' },
  { sheet: 'XE_BAOHIEM', nhom: 'Bảo hiểm', ref: 'Ref_Xe', expiry: 'NgayHetHan', scope: 'xe' },
  { sheet: 'XE_TAXIMET', nhom: 'Taximet', ref: 'Ref_Xe', expiry: 'NgayHetHanKiemDinh', scope: 'xe' },
  { sheet: 'XE_THECHAP_NGANHANG', nhom: 'Thế chấp', ref: 'Ref_Xe', expiry: 'NgayHetHan', status: 'TrangThaiTheChap', active: 'Đang thế chấp', scope: 'xe' },
  { sheet: 'LAIXE_GPLX', nhom: 'GPLX', ref: 'Ref_NhanSu', expiry: 'NgayHetHan', scope: 'ns' },
  { sheet: 'NHANSU_SUCKHOE', nhom: 'Khám sức khỏe', ref: 'Ref_NhanSu', expiry: 'NgayHetHan', scope: 'ns' },
  { sheet: 'NHANSU_HOPDONG_LAODONG', nhom: 'HĐLĐ', ref: 'Ref_NhanSu', expiry: 'NgayKetThuc', scope: 'ns' },
  { sheet: 'NHANSU_BHXH', nhom: 'BHXH', ref: 'Ref_NhanSu', expiry: 'NgayKetThucThamGia', status: 'TrangThaiBHXH', active: 'Đang tham gia', scope: 'ns' },
  { sheet: 'LAIXE_DAOTAO', nhom: 'Đào tạo', ref: 'Ref_NhanSu', expiry: 'NgayHetHan', scope: 'ns' }
];

// Tổng hợp hồ sơ pháp lý: đếm TOÀN BỘ dòng của 10 bảng (giống .gs), phân loại
// còn hạn / sắp hết / quá hạn theo ngày; thiếu = đối tượng active không có bản ghi;
// tuân thủ tính theo ĐỐI TƯỢNG (xe/người có ≥1 hồ sơ còn hiệu lực).
function buildHoSoSummary(tables, activeXeIds, activeNsIds, now = new Date()) {
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, y: d.getFullYear(), m: d.getMonth() });
  }
  const bienDongMoi = {};
  const bienDongHet = {};
  months.forEach((mo) => { bienDongMoi[mo.key] = 0; bienDongHet[mo.key] = 0; });
  const allCap = []; // mọi ngày cấp hồ sơ (để tính luỹ kế cuối kỳ)
  const allHet = []; // mọi ngày hết hạn hồ sơ

  const nhom = [];
  let tong = 0; let conHan = 0; let sapHet = 0; let quaHan = 0; let thieuHoSo = 0;

  HOSO_TABLES.forEach((h) => {
    const rows = Array.isArray(tables[h.sheet]) ? tables[h.sheet] : [];
    const activeSet = h.scope === 'xe' ? activeXeIds : activeNsIds;
    const soCanCo = activeSet.size;
    let g_tong = 0; let g_con = 0; let g_sap = 0; let g_qua = 0;
    const coHoSo = new Set(); // đối tượng có ≥1 bản ghi
    const dtConHan = new Set(); // đối tượng có ≥1 hồ sơ còn hiệu lực

    rows.forEach((row) => {
      const ref = cleanValue(row[h.ref]);
      if (!ref) return;
      coHoSo.add(ref);
      g_tong += 1; tong += 1;
      const expRaw = row[h.expiry];
      const expDate = parseDateValue(expRaw);
      let level;
      if (expDate) {
        level = getWarningLevel(expRaw, now).level; // do | vang | xanh
        // biến động hồ sơ: cấp mới (NgayCap) & hết hạn theo tháng
        const capDate = parseDateValue(row.NgayCap);
        if (capDate) { allCap.push(capDate.getTime()); const k = monthKey(capDate); if (k in bienDongMoi) bienDongMoi[k] += 1; }
        allHet.push(expDate.getTime());
        const k2 = monthKey(expDate); if (k2 in bienDongHet) bienDongHet[k2] += 1;
      } else if (h.active && cleanValue(row[h.status]) === h.active) {
        level = 'xanh'; // không có ngày nhưng trạng thái active (vd BHXH đang tham gia)
      } else {
        level = 'xam';
      }
      // Còn hiệu lực = mọi hồ sơ không quá hạn và không sắp hết (gồm cả bản ghi
      // thiếu ngày nhưng đang active) — khớp cách bản .gs hiển thị "còn hiệu lực".
      if (level === 'do') { g_qua += 1; quaHan += 1; }
      else if (level === 'vang') { g_sap += 1; sapHet += 1; dtConHan.add(ref); }
      else { g_con += 1; conHan += 1; if (level === 'xanh') dtConHan.add(ref); }
    });

    let g_thieu = 0;
    activeSet.forEach((id) => { if (!coHoSo.has(id)) g_thieu += 1; });
    thieuHoSo += g_thieu;
    let g_dtConHan = 0;
    dtConHan.forEach((id) => { if (activeSet.has(id)) g_dtConHan += 1; });

    nhom.push({
      nhom: h.nhom, scope: h.scope, tong: g_tong, conHan: g_con, sapHet: g_sap, quaHan: g_qua,
      thieu: g_thieu, canCo: soCanCo, dtConHan: g_dtConHan,
      tyLe: soCanCo ? Math.round((g_dtConHan / soCanCo) * 1000) / 10 : 0
    });
  });

  // Luỹ kế cuối kỳ = số hồ sơ đã cấp trước mốc − số đã hết hạn trước mốc.
  const demTruoc = (arr, moc) => arr.reduce((n, t) => (t <= moc ? n + 1 : n), 0);
  const bienDongSeries = months.map((mo) => {
    const end = new Date(mo.y, mo.m + 1, 0, 23, 59, 59).getTime();
    return {
      ky: mo.label,
      moi: bienDongMoi[mo.key],
      het: bienDongHet[mo.key],
      cuoiKy: demTruoc(allCap, end) - demTruoc(allHet, end)
    };
  });

  return {
    tong, conHan, sapHet, quaHan, thieuHoSo,
    nhom,
    bienDong: bienDongSeries
  };
}

/* ============================================================
 * BÁO CÁO CHI TIẾT — dựng sẵn các danh sách báo cáo (port từ buildBaoCao_ của .gs).
 * Trả về map key -> { columns:[...], rows:[{...}], dateKey } để frontend hiển thị + xuất.
 * ============================================================ */
function buildReportDatasets(tables, nhanSuReport, xeReport) {
  // Map nhanh id -> thông tin hiển thị.
  const nsInfo = new Map();
  nhanSuReport.forEach((r) => nsInfo.set(r.idNhanSu, { ten: r.hoTen, doiXe: r.doiXe, chucDanh: r.chucDanh }));
  const xeInfo = new Map();
  xeReport.forEach((r) => xeInfo.set(r.idXe, { ten: r.bienSo, doiXe: r.doiXe }));

  const S = (v) => cleanValue(v);
  const D = (v) => formatDashboardDate(v);

  // Báo cáo danh sách: join bảng con về master theo refCol, lấy các cột chỉ định.
  // masterMap: Map id -> {ten, doiXe, chucDanh?}; cols: [{col, label, date?}]
  function danhSach(sheet, refCol, masterMap, tenLabel, extraLabel, cols) {
    const rows = Array.isArray(tables[sheet]) ? tables[sheet] : [];
    const out = [];
    rows.forEach((row) => {
      const ref = cleanValue(row[refCol]);
      if (!ref) return;
      const m = masterMap.get(ref);
      if (!m) return;
      const rec = { ten: m.ten, phu: m.doiXe || m.chucDanh || '' };
      cols.forEach((c) => { rec[c.col] = c.date ? D(row[c.col]) : S(row[c.col]); });
      out.push(rec);
    });
    const columns = [['ten', tenLabel], ['phu', extraLabel]].concat(cols.map((c) => [c.col, c.label]));
    return { columns, rows: out };
  }

  // Báo cáo hết hạn: chỉ lấy bản ghi quá hạn hoặc sắp hết (theo expiryCol), sort gần nhất.
  function hetHan(sheet, refCol, expiryCol, masterMap, tenLabel, extraLabel, extraCols) {
    const rows = Array.isArray(tables[sheet]) ? tables[sheet] : [];
    const out = [];
    rows.forEach((row) => {
      const ref = cleanValue(row[refCol]);
      if (!ref) return;
      const m = masterMap.get(ref);
      if (!m) return;
      const wl = getWarningLevel(row[expiryCol]);
      if (wl.level !== 'do' && wl.level !== 'vang') return;
      const rec = { ten: m.ten, phu: m.doiXe || '', ngayHetHan: D(row[expiryCol]), conLai: wl.days == null ? '' : (wl.days < 0 ? `Quá ${-wl.days} ngày` : `${wl.days} ngày`), _days: wl.days == null ? 99999 : wl.days };
      (extraCols || []).forEach((c) => { rec[c.col] = S(row[c.col]); });
      out.push(rec);
    });
    out.sort((a, b) => a._days - b._days);
    out.forEach((r) => delete r._days);
    const columns = [['ten', tenLabel], ['phu', extraLabel]]
      .concat((extraCols || []).map((c) => [c.col, c.label]))
      .concat([['ngayHetHan', 'Ngày hết hạn'], ['conLai', 'Còn lại']]);
    return { columns, rows: out };
  }

  return {
    // Hồ sơ pháp lý — xe
    het_taximet: hetHan('XE_TAXIMET', 'Ref_Xe', 'NgayHetHanKiemDinh', xeInfo, 'Biển số', 'Đội xe', [{ col: 'SoThietBi', label: 'Số thiết bị' }]),
    xe_thechap: danhSach('XE_THECHAP_NGANHANG', 'Ref_Xe', xeInfo, 'Biển số', 'Đội xe', [
      { col: 'SoHopDongTheChap', label: 'Số HĐ thế chấp' }, { col: 'NgayTheChap', label: 'Ngày thế chấp', date: true },
      { col: 'NgayHetHan', label: 'Ngày hết hạn', date: true }, { col: 'TrangThaiTheChap', label: 'Trạng thái' }
    ]),
    xe_thoathuan_tnds: danhSach('XE_THOATHUAN_DANSU', 'Ref_Xe', xeInfo, 'Biển số', 'Đội xe', [
      { col: 'SoThoaThuan', label: 'Số thỏa thuận' }, { col: 'NgayKy', label: 'Ngày ký', date: true },
      { col: 'NgayHetHan', label: 'Ngày hết hạn', date: true }, { col: 'TrangThaiThoaThuan', label: 'Trạng thái' }
    ]),
    // Hồ sơ pháp lý — nhân sự
    ns_sap_het_skhoe: hetHan('NHANSU_SUCKHOE', 'Ref_NhanSu', 'NgayHetHan', nsInfo, 'Họ và tên', 'Đội xe', [{ col: 'LoaiKhamSucKhoe', label: 'Loại khám' }]),
    ns_sap_het_daotao: hetHan('LAIXE_DAOTAO', 'Ref_NhanSu', 'NgayHetHan', nsInfo, 'Họ và tên', 'Đội xe', [{ col: 'NoiDungDaoTao', label: 'Nội dung' }]),
    ns_sap_het_hdld: hetHan('NHANSU_HOPDONG_LAODONG', 'Ref_NhanSu', 'NgayKetThuc', nsInfo, 'Họ và tên', 'Đội xe', [{ col: 'SoHopDong', label: 'Số HĐ' }, { col: 'LoaiHopDong', label: 'Loại HĐ' }]),
    // Khen thưởng / vi phạm / phản ánh
    ns_khenthuong_kyluat: danhSach('LAIXE_KHENTHUONG_KYLUAT', 'Ref_NhanSu', nsInfo, 'Họ và tên', 'Đội xe', [
      { col: 'Loai', label: 'Loại' }, { col: 'NgayApDung', label: 'Ngày áp dụng', date: true }, { col: 'NoiDung', label: 'Nội dung' },
      { col: 'HinhThuc', label: 'Hình thức' }, { col: 'MucDo', label: 'Mức độ' }, { col: 'TrangThai', label: 'Trạng thái' }
    ]),
    lx_vipham_atgt: danhSach('LAIXE_VIPHAM_ATGT', 'Ref_NhanSu', nsInfo, 'Họ và tên', 'Đội xe', [
      { col: 'NgayViPham', label: 'Ngày vi phạm', date: true }, { col: 'HanhViViPham', label: 'Hành vi' }, { col: 'SoBienBan', label: 'Số biên bản' },
      { col: 'HinhThucXuLy', label: 'Hình thức xử lý' }, { col: 'SoTienPhat', label: 'Tiền phạt' }, { col: 'TrangThaiXuLy', label: 'Trạng thái' }
    ]),
    lx_vipham_noibo: danhSach('LAIXE_VIPHAM_NOIBO', 'Ref_NhanSu', nsInfo, 'Họ và tên', 'Đội xe', [
      { col: 'NgayViPham', label: 'Ngày vi phạm', date: true }, { col: 'NoiDungViPham', label: 'Nội dung' }, { col: 'MucDoViPham', label: 'Mức độ' },
      { col: 'HinhThucXuLy', label: 'Hình thức xử lý' }, { col: 'TrangThaiXuLy', label: 'Trạng thái' }
    ]),
    phan_anh: danhSach('PHAN_ANH_KHIEU_NAI', 'Ref_NhanSuBiPhanAnh', nsInfo, 'NS bị phản ánh', 'Đội xe', [
      { col: 'SoVuViec', label: 'Số vụ việc' }, { col: 'NgayPhanAnh', label: 'Ngày phản ánh', date: true }, { col: 'NoiDungPhanAnh', label: 'Nội dung' },
      { col: 'MucDo', label: 'Mức độ' }, { col: 'TrangThaiXuLy', label: 'Trạng thái xử lý' }
    ])
  };
}

function buildDashboardReport(tables, missingSources) {
  // Bỏ dòng rỗng (không có khóa) để tổng khớp bản .gs.
  const nhanSuRows = (tables.NHANSU || []).filter((row) => cleanValue(row.ID_NhanSu));
  const xeRows = (tables.XE || []).filter((row) => cleanValue(row.ID_Xe));
  const donViById = buildLookupMap(tables.DONVI, ['ID_DonVi', 'MaDonVi', 'TenVietTat', 'TenDonVi']);
  const boPhanById = buildLookupMap(tables.DM_BOPHAN, ['ID_BoPhan', 'MaBoPhan', 'TenBoPhan']);
  const chucDanhById = buildLookupMap(tables.DM_CHUCDANH, ['ID_ChucDanh', 'TenChucDanh']);
  const doiXeById = buildLookupMap(tables.DM_DOIXE, ['ID_DoiXe', 'ID_Doi', 'ID_DM_DOIXE', 'MaDoiXe', 'MaDoi', 'TenDoiXe', 'Display']);
  const nganHangById = buildLookupMap(tables.DM_NGANHANG, ['ID_NganHang', 'MaNganHang', 'TenNganHang', 'TenVietTat']);
  const doiXeLegacyMap = buildDoiXeLegacyMap(tables.LOG_GAN_DOIXE_NHANSU);
  const xeById = buildLookupMap(xeRows, ['ID_Xe', 'BienSo']);
  const nhanSuById = buildLookupMap(nhanSuRows, ['ID_NhanSu']);
  const hopDongByNhanSu = groupRowsBy(tables.NHANSU_HOPDONG_LAODONG, 'Ref_NhanSu');
  const bhxhByNhanSu = groupRowsBy(tables.NHANSU_BHXH, 'Ref_NhanSu');
  const gplxByNhanSu = groupRowsBy(tables.LAIXE_GPLX, 'Ref_NhanSu');
  const sucKhoeByNhanSu = groupRowsBy(tables.NHANSU_SUCKHOE, 'Ref_NhanSu');
  const daoTaoByNhanSu = groupRowsBy(tables.LAIXE_DAOTAO, 'Ref_NhanSu');
  const thoaThuanByNhanSu = groupRowsBy(tables.XE_THOATHUAN_DANSU, 'Ref_LaiXe');
  const nguoiThanByNhanSu = groupRowsBy(tables.NHANSU_NGUOITHAN, 'Ref_NhanSu');
  const phanCongByNhanSu = groupRowsBy(tables.LAIXE_PHANCONG_XE, 'Ref_NhanSu');
  const phanCongByXe = groupRowsBy(tables.LAIXE_PHANCONG_XE, 'Ref_Xe');
  const phuHieuByXe = groupRowsBy(tables.XE_PHUHIEU, 'Ref_Xe');
  const dangKiemByXe = groupRowsBy(tables.XE_DANGKIEM, 'Ref_Xe');
  const baoHiemByXe = groupRowsBy(tables.XE_BAOHIEM, 'Ref_Xe');
  const taximetByXe = groupRowsBy(tables.XE_TAXIMET, 'Ref_Xe');
  const theChapByXe = groupRowsBy(tables.XE_THECHAP_NGANHANG, 'Ref_Xe');
  const kmByXe = groupRowsBy(tables.XE_SO_KM_THANG, 'Ref_Xe');
  const xuatHangByXe = groupRowsBy(tables.XE_XUAT_HANG, 'Ref_Xe');

  const warnings = [];
  const nhanSuReport = nhanSuRows.map((nhanSu, index) => {
    const nhanSuId = cleanValue(nhanSu.ID_NhanSu);
    const hopDong = pickCurrentRow(hopDongByNhanSu.get(nhanSuId), { dateFields: ['NgayKetThuc', 'NgayBatDau', 'NgayKy'] });
    const bhxh = pickCurrentRow(bhxhByNhanSu.get(nhanSuId), { statusFields: ['TrangThaiBHXH'], activeKeywords: ['đang tham gia'], dateFields: ['NgayBatDauThamGia', 'NgayKetThucThamGia'] });
    const gplx = pickCurrentRow(gplxByNhanSu.get(nhanSuId), { dateFields: ['NgayHetHan', 'NgayCap'] });
    const sucKhoe = pickCurrentRow(sucKhoeByNhanSu.get(nhanSuId), { dateFields: ['NgayHetHan', 'NgayKham'] });
    const daoTao = pickCurrentRow(daoTaoByNhanSu.get(nhanSuId), { dateFields: ['NgayHetHan', 'NgayCapChungChi'] });
    const thoaThuan = pickCurrentRow(thoaThuanByNhanSu.get(nhanSuId), { statusFields: ['TrangThaiThoaThuan'], dateFields: ['NgayHetHan', 'NgayKy'] });
    const nguoiBaoLanh = pickGuarantor(nguoiThanByNhanSu.get(nhanSuId));
    const phanCong = pickCurrentRow(phanCongByNhanSu.get(nhanSuId), { dateFields: ['NgayBatDau', 'NgayKetThuc'] });
    const xe = xeById.get(cleanValue(phanCong?.Ref_Xe)) || xeById.get(cleanValue(nhanSu.Ref_XeHienTai));
    const donVi = donViById.get(cleanValue(nhanSu.Ref_DonViDuocCapPH));
    const boPhan = boPhanById.get(cleanValue(nhanSu.Ref_BoPhan));
    const chucDanh = chucDanhById.get(cleanValue(nhanSu.Ref_ChucDanh)) || chucDanhById.get(cleanValue(hopDong?.Ref_ChucDanh));
    const doiXeRef = cleanValue(nhanSu.Ref_DoiXe);
    const doiXe = doiXeById.get(doiXeRef);
    const doiXeWarning = buildDoiXeWarning(doiXe, doiXeRef, doiXeLegacyMap);
    const warningItems = [
      { name: 'Hợp đồng lao động', date: formatDashboardDate(hopDong?.NgayKetThuc), ...getWarningLevel(hopDong?.NgayKetThuc) },
      { name: 'GPLX', date: formatDashboardDate(gplx?.NgayHetHan), ...getWarningLevel(gplx?.NgayHetHan) },
      { name: 'Sức khỏe', date: formatDashboardDate(sucKhoe?.NgayHetHan), ...getWarningLevel(sucKhoe?.NgayHetHan) }
    ];
    if (doiXeWarning) warningItems.push(doiXeWarning);
    warningItems.forEach((item) => {
      if (item.level !== 'xanh') warnings.push({ scope: 'nhan-su', subject: getDisplayName(nhanSu, ['HoTen', 'Display'], nhanSuId), id: nhanSuId, ...item });
    });

    return {
      stt: index + 1,
      idNhanSu: nhanSuId,
      hoTen: getDisplayName(nhanSu, ['HoTen', 'Display'], nhanSuId),
      cccd: cleanValue(nhanSu.CCCD),
      ngaySinh: formatDashboardDate(nhanSu.NgaySinh),
      ngayNhanViec: formatDashboardDate(nhanSu.NgayNhanViec),
      ngayNghiViec: formatDashboardDate(nhanSu.NgayNghiViec),
      gioiTinh: cleanValue(nhanSu.GioiTinh),
      loaiNhanSu: cleanValue(nhanSu.LoaiNhanSu),
      soDienThoai: cleanValue(nhanSu.SoDienThoai),
      donVi: getDisplayName(donVi, ['TenDonVi', 'TenVietTat', 'Display']),
      doiXe: resolveDoiXeDisplay(doiXe, doiXeRef, doiXeLegacyMap),
      boPhan: getDisplayName(boPhan, ['TenBoPhan', 'MaBoPhan', 'Display'], cleanValue(nhanSu.Ref_BoPhan)),
      chucDanh: getDisplayName(chucDanh, ['TenChucDanh', 'Display'], cleanValue(nhanSu.Ref_ChucDanh)),
      trangThaiLamViec: cleanValue(nhanSu.TrangThai),
      xeDangLai: getDisplayName(xe, ['BienSo', 'Display'], cleanValue(phanCong?.Ref_Xe || nhanSu.Ref_XeHienTai)),
      bienSoXe: cleanValue(xe?.BienSo),
      loaiHopDong: cleanValue(hopDong?.LoaiHopDong),
      soHopDong: cleanValue(hopDong?.SoHopDong),
      ngayKyHopDong: formatDashboardDate(hopDong?.NgayKy),
      ngayBatDau: formatDashboardDate(hopDong?.NgayBatDau),
      ngayKetThuc: formatDashboardDate(hopDong?.NgayKetThuc),
      trangThaiHopDong: cleanValue(hopDong?.TrangThai),
      soGplx: cleanValue(gplx?.SoGPLX),
      hangGplx: cleanValue(gplx?.HangGPLX),
      ngayCapGplx: formatDashboardDate(gplx?.NgayCap),
      hanGplx: formatDashboardDate(gplx?.NgayHetHan),
      ngayCapGksk: formatDashboardDate(sucKhoe?.NgayKham),
      hanSucKhoe: formatDashboardDate(sucKhoe?.NgayHetHan),
      thoiGianTapHuan: cleanValue(daoTao?.NoiDungDaoTao) || cleanValue(daoTao?.SoNgayDaoTao),
      ngayCapGcnTapHuan: formatDashboardDate(daoTao?.NgayCapChungChi),
      ngayHetHanGcn: formatDashboardDate(daoTao?.NgayHetHan),
      ngayKyThoaThuan: formatDashboardDate(thoaThuan?.NgayKy),
      ngayKetThucThoaThuan: formatDashboardDate(thoaThuan?.NgayHetHan),
      soSoBhxh: cleanValue(bhxh?.SoSoBHXH),
      maSoBhxh: cleanValue(bhxh?.MaSoBHXH),
      trangThaiBhxh: cleanValue(bhxh?.TrangThaiBHXH),
      mucLuongDongBhxh: cleanValue(bhxh?.MucLuongDongBHXH),
      hoTenNguoiBaoLanh: cleanValue(nguoiBaoLanh?.HoTen),
      sdtNguoiBaoLanh: cleanValue(nguoiBaoLanh?.SoDienThoai),
      canhBao: buildWarningNote(warningItems),
      warningLevel: warningItems.some((item) => item.level === 'do') ? 'do' : warningItems.some((item) => item.level === 'vang') ? 'vang' : warningItems.some((item) => item.level === 'xam') ? 'xam' : 'xanh',
      warningItems: pickActiveWarnings(warningItems)
    };
  });

  const xeReport = xeRows.map((xe, index) => {
    const xeId = cleanValue(xe.ID_Xe);
    const phanCong = pickCurrentRow(phanCongByXe.get(xeId), { dateFields: ['NgayBatDau', 'NgayKetThuc'] });
    const laiXe = nhanSuById.get(cleanValue(phanCong?.Ref_NhanSu)) || nhanSuRows.find((item) => cleanValue(item.Ref_XeHienTai) === xeId);
    const phuHieu = pickCurrentRow(phuHieuByXe.get(xeId), { dateFields: ['NgayHetHan', 'NgayCap'] });
    const dangKiem = pickCurrentRow(dangKiemByXe.get(xeId), { dateFields: ['NgayHetHan', 'HanDangKiem', 'NgayHetHanDangKiem', 'NgayHetHanKiemDinh'] });
    const baoHiemRows = baoHiemByXe.get(xeId) || [];
    const baoHiemTnds = pickCurrentRow(baoHiemRows.filter((row) => valueContains(row.LoaiBaoHiem, ['tnds', 'trach nhiem', 'trách nhiệm'])), { statusFields: ['TrangThaiBaoHiem'], dateFields: ['NgayHetHan', 'NgayCap'] });
    const baoHiemThanVo = pickCurrentRow(baoHiemRows.filter((row) => valueContains(row.LoaiBaoHiem, ['than vo', 'thân vỏ', 'vat chat', 'vật chất'])), { statusFields: ['TrangThaiBaoHiem'], dateFields: ['NgayHetHan', 'NgayCap'] });
    const taximet = pickCurrentRow(taximetByXe.get(xeId), { dateFields: ['NgayHetHanKiemDinh', 'NgayKiemDinh'] });
    const theChap = pickCurrentRow(theChapByXe.get(xeId), { statusFields: ['TrangThaiTheChap', 'TrangThaiKhoanVay'], dateFields: ['NgayHetHan', 'NgayTheChap'] });
    const kmRow = pickCurrentRow(kmByXe.get(xeId), { dateFields: ['Nam', 'Thang', 'NgayTao'] });
    const xuatHang = pickCurrentRow(xuatHangByXe.get(xeId), { dateFields: ['NgayXuatHang'] });
    const donViChuQuan = donViById.get(cleanValue(xe.Ref_DonViChuQuan));
    const donViQuanLy = donViById.get(cleanValue(xe.Ref_DonViQuanLyHienTai));
    const doiXeRef = cleanValue(xe.Ref_DoiXe) || cleanValue(laiXe?.Ref_DoiXe);
    const doiXe = doiXeById.get(cleanValue(xe.Ref_DoiXe)) || doiXeById.get(cleanValue(laiXe?.Ref_DoiXe));
    const doiXeWarning = buildDoiXeWarning(doiXe, doiXeRef, doiXeLegacyMap);
    const nganHang = nganHangById.get(cleanValue(theChap?.Ref_NganHang));
    const warningItems = [
      { name: 'Phù hiệu', date: formatDashboardDate(phuHieu?.NgayHetHan), ...getWarningLevel(phuHieu?.NgayHetHan) },
      { name: 'Đăng kiểm', date: formatDashboardDate(getFirstValue(dangKiem, ['NgayHetHan', 'HanDangKiem', 'NgayHetHanDangKiem', 'NgayHetHanKiemDinh'])), ...getWarningLevel(getFirstValue(dangKiem, ['NgayHetHan', 'HanDangKiem', 'NgayHetHanDangKiem', 'NgayHetHanKiemDinh'])) },
      { name: 'Bảo hiểm TNDS', date: formatDashboardDate(baoHiemTnds?.NgayHetHan), ...getWarningLevel(baoHiemTnds?.NgayHetHan) },
      { name: 'Bảo hiểm thân vỏ', date: formatDashboardDate(baoHiemThanVo?.NgayHetHan), ...getWarningLevel(baoHiemThanVo?.NgayHetHan) },
      { name: 'Taximet', date: formatDashboardDate(taximet?.NgayHetHanKiemDinh), ...getWarningLevel(taximet?.NgayHetHanKiemDinh) },
      ...(theChap ? [{ name: 'Thế chấp', date: formatDashboardDate(theChap?.NgayHetHan), ...getWarningLevel(theChap?.NgayHetHan) }] : [])
    ];
    if (doiXeWarning) warningItems.push(doiXeWarning);
    warningItems.forEach((item) => {
      if (item.level !== 'xanh') warnings.push({ scope: 'xe', subject: cleanValue(xe.BienSo) || xeId, id: xeId, ...item });
    });

    return {
      stt: index + 1,
      idXe: xeId,
      bienSo: cleanValue(xe.BienSo),
      maDam: cleanValue(xe.MaDam),
      tenDangKyXe: cleanValue(xe.TenDangKyXe),
      soKhung: cleanValue(xe.SoKhung),
      soMay: cleanValue(xe.SoMay),
      nhanHieu: cleanValue(xe.NhanHieu),
      loaiXe: cleanValue(xe.LoaiXe),
      soCho: cleanValue(xe.SoCho),
      namSanXuat: cleanValue(xe.NamSanXuat),
      mauSon: cleanValue(xe.MauSon),
      ngayDuaVaoHoatDong: formatDashboardDate(xe.NgayDuaVaoHoatDong),
      ngayNgungHoatDong: formatDashboardDate(xe.NgayNgungHoatDong),
      donViChuQuan: getDisplayName(donViChuQuan, ['TenDonVi', 'TenVietTat', 'Display'], cleanValue(xe.Ref_DonViChuQuan)),
      donViQuanLyHienTai: getDisplayName(donViQuanLy, ['TenDonVi', 'TenVietTat', 'Display'], cleanValue(xe.Ref_DonViQuanLyHienTai)),
      doiXe: resolveDoiXeDisplay(doiXe, doiXeRef, doiXeLegacyMap),
      trangThaiXe: cleanValue(xe.TrangThaiXe),
      soLaiXe: (phanCongByXe.get(xeId) || []).filter((pc) => valueContains(pc.TrangThai, ['đang', 'hieu luc', 'hiệu lực']) || !cleanValue(pc.TrangThai)).length,
      laiXeDangLai: getDisplayName(laiXe, ['HoTen', 'Display'], cleanValue(phanCong?.Ref_NhanSu)),
      soPhuHieu: cleanValue(phuHieu?.SoPhuHieu),
      hanPhuHieu: formatDashboardDate(phuHieu?.NgayHetHan),
      hanDangKiem: formatDashboardDate(getFirstValue(dangKiem, ['NgayHetHan', 'HanDangKiem', 'NgayHetHanDangKiem', 'NgayHetHanKiemDinh'])),
      hanBaoHiemTnds: formatDashboardDate(baoHiemTnds?.NgayHetHan),
      hanBaoHiemThanVo: formatDashboardDate(baoHiemThanVo?.NgayHetHan),
      hanTaximet: formatDashboardDate(taximet?.NgayHetHanKiemDinh),
      coTheChapKhong: theChap ? 'Có' : cleanValue(xe.IsTheChap),
      nganHangTheChap: getDisplayName(nganHang, ['TenNganHang', 'TenVietTat', 'Display'], cleanValue(theChap?.Ref_NganHang)),
      hanTheChap: formatDashboardDate(theChap?.NgayHetHan),
      trangThaiKhoanVay: cleanValue(theChap?.TrangThaiKhoanVay),
      kmLuyKe: cleanValue(kmRow?.LuyKeKmXeChay) || cleanValue(kmRow?.SoKmHoatDong),
      soChuyenThang: cleanValue(kmRow?.SoChuyenTrongThang),
      daXuatHang: xuatHang ? 'Có' : '',
      ngayXuatHang: formatDashboardDate(xuatHang?.NgayXuatHang),
      canhBao: buildWarningNote(warningItems),
      warningLevel: warningItems.some((item) => item.level === 'do') ? 'do' : warningItems.some((item) => item.level === 'vang') ? 'vang' : warningItems.some((item) => item.level === 'xam') ? 'xam' : 'xanh',
      warningItems: pickActiveWarnings(warningItems)
    };
  });

  const activeNhanSu = nhanSuReport.filter((item) => item.trangThaiLamViec && !valueContains(item.trangThaiLamViec, ['nghi', 'nghỉ']));
  const inactiveNhanSu = nhanSuReport.filter((item) => valueContains(item.trangThaiLamViec, ['nghi', 'nghỉ']));
  const activeXe = xeReport.filter((item) => item.trangThaiXe && !valueContains(item.trangThaiXe, ['ngung', 'ngừng']));
  const inactiveXe = xeReport.filter((item) => valueContains(item.trangThaiXe, ['ngung', 'ngừng']));
  const warningCounts = countBy(warnings, 'level');

  // Tổng hợp hồ sơ pháp lý (đếm toàn bộ dòng 10 bảng — khớp bản .gs).
  const activeXeIds = new Set(activeXe.map((item) => item.idXe).filter(Boolean));
  const activeNsIds = new Set(activeNhanSu.map((item) => item.idNhanSu).filter(Boolean));
  const hoSoSummary = buildHoSoSummary(tables, activeXeIds, activeNsIds);
  const reportTables = buildReportDatasets(tables, nhanSuReport, xeReport);

  return {
    row: {},
    related: {},
    summary: {
      tongNhanSu: nhanSuReport.length,
      nhanSuDangLamViec: activeNhanSu.length,
      nhanSuNghiViec: inactiveNhanSu.length,
      tongXe: xeReport.length,
      xeHoatDong: activeXe.length,
      xeNgung: inactiveXe.length,
      canhBaoDo: warnings.filter((item) => item.level === 'do').length,
      canhBaoVang: warnings.filter((item) => item.level === 'vang').length,
      canhBaoXam: warnings.filter((item) => item.level === 'xam').length
    },
    filters: {
      donVi: uniqueValues([...nhanSuReport.map((item) => item.donVi), ...xeReport.map((item) => item.donViChuQuan)]),
      doiXe: sortDoiXeValues([...nhanSuReport.map((item) => item.doiXe), ...xeReport.map((item) => item.doiXe)]),
      loaiXe: uniqueValues(xeReport.map((item) => item.loaiXe)),
      trangThaiXe: uniqueValues(xeReport.map((item) => item.trangThaiXe)),
      trangThaiNhanSu: uniqueValues(nhanSuReport.map((item) => item.trangThaiLamViec)),
      loaiHopDong: uniqueValues(nhanSuReport.map((item) => item.loaiHopDong)),
      trangThaiHopDong: uniqueValues(nhanSuReport.map((item) => item.trangThaiHopDong)),
      trangThaiBhxh: uniqueValues(nhanSuReport.map((item) => item.trangThaiBhxh)),
      nhomCanhBao: ['do', 'vang', 'xanh', 'xam']
    },
    charts: {
      nhanSuTheoTrangThai: countBy(nhanSuReport, 'trangThaiLamViec'),
      nhanSuTheoChucDanh: countBy(nhanSuReport, 'chucDanh'),
      xeTheoTrangThai: countBy(xeReport, 'trangThaiXe'),
      xeTheoLoai: countBy(xeReport, 'loaiXe'),
      canhBaoTheoMuc: warningCounts,
      topKm: [...xeReport].sort((a, b) => getNumberValue(b.kmLuyKe) - getNumberValue(a.kmLuyKe)).slice(0, 10).map((item) => ({ label: item.bienSo || item.idXe, value: getNumberValue(item.kmLuyKe) })),
      topChuyen: [...xeReport].sort((a, b) => getNumberValue(b.soChuyenThang) - getNumberValue(a.soChuyenThang)).slice(0, 10).map((item) => ({ label: item.bienSo || item.idXe, value: getNumberValue(item.soChuyenThang) }))
    },
    reports: {
      nhanSu: nhanSuReport,
      xe: xeReport
    },
    hoSoSummary,
    reportTables,
    warnings,
    missingSources,
    generatedAt: new Date().toISOString(),
    warningDays: DASHBOARD_WARNING_DAYS
  };
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
  'dashboard-qlvt': {
    idKeys: [],
    missingIdMessage: '',
    notFoundPrefix: '',
    failedMessage: 'Không tải được dữ liệu dashboard QLVT từ Google Sheets.',
    mainKey: '',
    build: async ({ env }) => {
      const { tables, missingSources } = await readDashboardTables(DASHBOARD_TABLES, env);
      return buildDashboardReport(tables, missingSources);
    }
  },

  'vehicle-profile': {
    idKeys: ['ID_Xe', 'idXe', 'idxe', 'IDXe'],
    missingIdMessage: 'Thiếu tham số ID_Xe.',
    notFoundPrefix: 'Không tìm thấy xe với ID_Xe',
    failedMessage: 'Không tải được hồ sơ phương tiện từ Google Sheets.',
    mainKey: 'ID_Xe',
    build: ({ id, query, env }) => buildVehicleProfileBundle({ id, query, env })
  },

  'nhan-su-profile': {
    idKeys: ['ID_NhanSu', 'idNhanSu', 'idnhansu', 'IDNhanSu'],
    missingIdMessage: 'Thiếu tham số ID_NhanSu.',
    notFoundPrefix: 'Không tìm thấy nhân sự với ID_NhanSu',
    failedMessage: 'Không tải được hồ sơ nhân sự từ Google Sheets.',
    mainKey: 'ID_NhanSu',
    build: ({ id, query, env }) => buildNhanSuProfileBundle({ id, query, env })
  },

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
