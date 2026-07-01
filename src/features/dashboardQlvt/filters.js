import { parseDateValue } from '../../lib/dateFormat';

// Nhóm trạng thái nhân sự để lọc nhanh từ card (đang làm việc / nghỉ việc).
export const NHOM_TRANG_THAI_NHAN_SU = {
  'dang-lam': (value) => Boolean(cleanValue(value)) && !normalizeText(value).includes('nghi'),
  nghi: (value) => normalizeText(value).includes('nghi')
};

// Nhóm trạng thái xe để lọc nhanh từ card (đang hoạt động / ngừng).
export const NHOM_TRANG_THAI_XE = {
  'hoat-dong': (value) => Boolean(cleanValue(value)) && !normalizeText(value).includes('ngung'),
  ngung: (value) => normalizeText(value).includes('ngung')
};

export function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeText(value) {
  return cleanValue(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function matchesText(value, selected) {
  if (!cleanValue(selected)) return true;
  return normalizeText(value) === normalizeText(selected);
}

function matchesWarningLevel(row, selected) {
  if (!cleanValue(selected)) return true;
  const target = normalizeText(selected);
  if (Array.isArray(row.warningItems)) {
    if (target === 'xanh') return row.warningItems.length === 0;
    return row.warningItems.some((item) => normalizeText(item.level) === target);
  }
  return normalizeText(row.warningLevel) === target;
}

// Số ngày còn lại tới khi hết hạn (âm = đã quá hạn). Ưu tiên giá trị days từ
// backend, nếu không có thì tự tính lại từ chuỗi ngày để bộ lọc vẫn chạy.
export function warningDaysLeft(item, today = new Date()) {
  if (item && Number.isFinite(item.days)) return item.days;
  const date = parseDateValue(item?.date);
  if (!date) return null;
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target.getTime() - startToday.getTime()) / 86400000);
}

// Một item warning có khớp loại giấy tờ đang chọn không.
// "Bảo hiểm" (gộp) khớp cả TNDS lẫn thân vỏ để dùng chung cho card KPI.
export function warningItemMatchesLoai(item, selected) {
  const target = normalizeText(selected);
  if (target === normalizeText('Bảo hiểm')) return normalizeText(item?.name).includes('bao hiem');
  return normalizeText(item?.name) === target;
}

// Bộ lọc theo từng loại giấy tờ (đăng kiểm, bảo hiểm, GPLX...).
function matchesLoaiGiayTo(row, selected) {
  if (!cleanValue(selected)) return true;
  const items = Array.isArray(row.warningItems) ? row.warningItems : [];
  return items.some((item) => warningItemMatchesLoai(item, selected));
}

// Bộ lọc theo tình trạng hạn: quá hạn / sắp hết hạn 15-30 ngày / còn hiệu lực.
// Khi đã chọn loại giấy tờ thì chỉ xét đúng loại đó, nếu không thì xét mọi cảnh báo.
function matchesTinhTrangHan(row, filters) {
  const status = cleanValue(filters.tinhTrangHan);
  if (!status) return true;
  const items = (Array.isArray(row.warningItems) ? row.warningItems : [])
    .filter((item) => !cleanValue(filters.loaiGiayTo) || warningItemMatchesLoai(item, filters.loaiGiayTo));

  if (status === 'con-hieu-luc') {
    return items.every((item) => normalizeText(item.level) === 'xanh');
  }
  return items.some((item) => {
    const level = normalizeText(item.level);
    if (status === 'qua-han') return level === 'do';
    if (status === 'canh-bao') return level === 'do' || level === 'vang';
    if (level !== 'do' && level !== 'vang') return false;
    const days = warningDaysLeft(item);
    if (days === null) return false;
    if (status === 'sap-15') return days >= 0 && days <= 15;
    if (status === 'sap-30') return days >= 0 && days <= 30;
    return false;
  });
}

// Chuyển 'YYYY-MM-DD' -> mốc ngày (bỏ giờ). Trả null nếu không hợp lệ.
function parseDayValue(value) {
  const date = parseDateValue(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function rowDays(row, keys) {
  return keys
    .map((key) => parseDateValue(row?.[key]))
    .filter(Boolean)
    .map((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime());
}

// Lọc theo khoảng ngày Từ ngày / Đến ngày (dùng <input type="date">).
function matchesDateRange(row, keys, filters) {
  const from = parseDayValue(filters.tuNgay);
  const to = parseDayValue(filters.denNgay);
  if (!from && !to) return true;
  const days = rowDays(row, keys);
  if (days.length === 0) return true;
  return days.some((day) => (!from || day >= from) && (!to || day <= to));
}

// Khớp chức danh kiểu chứa (vd "Lái xe" khớp cả "Lái xe hạng B").
function matchesChucDanh(value, selected) {
  if (!cleanValue(selected)) return true;
  return normalizeText(value).includes(normalizeText(selected));
}

// Khớp nhóm trạng thái (đang làm việc / nghỉ; hoạt động / ngừng) theo cùng quy tắc với card KPI.
function matchesNhomTrangThai(value, selected, groups) {
  const predicate = groups[cleanValue(selected)];
  return predicate ? predicate(value) : true;
}

export function filterNhanSuRows(rows, filters) {
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    matchesText(row.donVi, filters.donVi) &&
    matchesText(row.doiXe, filters.doiXe) &&
    matchesText(row.trangThaiLamViec, filters.trangThaiNhanSu) &&
    matchesText(row.gioiTinh, filters.gioiTinh) &&
    matchesNhomTrangThai(row.trangThaiLamViec, filters.nhomTrangThaiNhanSu, NHOM_TRANG_THAI_NHAN_SU) &&
    matchesChucDanh(row.chucDanh, filters.chucDanh) &&
    matchesText(row.loaiHopDong, filters.loaiHopDong) &&
    matchesText(row.trangThaiHopDong, filters.trangThaiHopDong) &&
    matchesText(row.trangThaiBhxh, filters.trangThaiBhxh) &&
    matchesWarningLevel(row, filters.nhomCanhBao) &&
    matchesLoaiGiayTo(row, filters.loaiGiayTo) &&
    matchesTinhTrangHan(row, filters) &&
    matchesDateRange(row, ['ngayKyHopDong', 'ngayBatDau', 'ngayKetThuc', 'hanGplx', 'hanSucKhoe'], filters)
  )).map((row, index) => ({ ...row, stt: index + 1 }));
}

export function filterXeRows(rows, filters) {
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    matchesText(row.donViChuQuan, filters.donVi) &&
    matchesText(row.doiXe, filters.doiXe) &&
    matchesText(row.loaiXe, filters.loaiXe) &&
    matchesText(row.trangThaiXe, filters.trangThaiXe) &&
    matchesNhomTrangThai(row.trangThaiXe, filters.nhomTrangThaiXe, NHOM_TRANG_THAI_XE) &&
    matchesWarningLevel(row, filters.nhomCanhBao) &&
    matchesLoaiGiayTo(row, filters.loaiGiayTo) &&
    matchesTinhTrangHan(row, filters) &&
    matchesDateRange(row, ['hanPhuHieu', 'hanDangKiem', 'hanBaoHiemTnds', 'hanBaoHiemThanVo', 'hanTaximet', 'hanTheChap'], filters)
  )).map((row, index) => ({ ...row, stt: index + 1 }));
}

export function countBy(rows, keyName) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const label = cleanValue(row?.[keyName]) || 'Chưa có dữ liệu';
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}
