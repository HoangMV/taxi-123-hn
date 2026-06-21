import { parseDateValue } from '../lib/dateFormat';

export const NHAN_SU_COLUMNS = [
  ['stt', 'STT'],
  ['idNhanSu', 'ID nhân sự'],
  ['hoTen', 'Họ tên'],
  ['cccd', 'CCCD'],
  ['ngaySinh', 'Ngày sinh'],
  ['soDienThoai', 'Số điện thoại'],
  ['doiXe', 'Đội xe'],
  ['boPhan', 'Bộ phận'],
  ['chucDanh', 'Chức danh'],
  ['trangThaiLamViec', 'Trạng thái làm việc'],
  ['xeDangLai', 'Xe đang lái'],
  ['bienSoXe', 'Biển số xe'],
  ['loaiHopDong', 'Loại hợp đồng'],
  ['soHopDong', 'Số hợp đồng'],
  ['ngayKyHopDong', 'Ngày ký hợp đồng'],
  ['ngayBatDau', 'Ngày bắt đầu'],
  ['ngayKetThuc', 'Ngày kết thúc'],
  ['trangThaiHopDong', 'Trạng thái hợp đồng'],
  ['soGplx', 'Số GPLX'],
  ['hangGplx', 'Hạng GPLX'],
  ['hanGplx', 'Hạn GPLX'],
  ['hanSucKhoe', 'Hạn sức khỏe'],
  ['soSoBhxh', 'Số sổ BHXH'],
  ['maSoBhxh', 'Mã số BHXH'],
  ['trangThaiBhxh', 'Trạng thái BHXH'],
  ['mucLuongDongBhxh', 'Mức lương đóng BHXH'],
  ['canhBao', 'Ghi chú cảnh báo']
];

export const XE_COLUMNS = [
  ['stt', 'STT'],
  ['idXe', 'ID xe'],
  ['bienSo', 'Biển số'],
  ['maDam', 'Mã đàm'],
  ['tenDangKyXe', 'Tên đăng ký xe'],
  ['soKhung', 'Số khung'],
  ['soMay', 'Số máy'],
  ['nhanHieu', 'Nhãn hiệu'],
  ['loaiXe', 'Loại xe'],
  ['soCho', 'Số chỗ'],
  ['namSanXuat', 'Năm sản xuất'],
  ['mauSon', 'Màu sơn'],
  ['donViChuQuan', 'Đơn vị chủ quản'],
  ['donViQuanLyHienTai', 'Đơn vị quản lý hiện tại'],
  ['doiXe', 'Đội xe'],
  ['trangThaiXe', 'Trạng thái xe'],
  ['laiXeDangLai', 'Lái xe đang lái'],
  ['soPhuHieu', 'Số phù hiệu'],
  ['hanPhuHieu', 'Hạn phù hiệu'],
  ['hanDangKiem', 'Hạn đăng kiểm'],
  ['hanBaoHiemTnds', 'Hạn bảo hiểm TNDS'],
  ['hanBaoHiemThanVo', 'Hạn bảo hiểm thân vỏ'],
  ['hanTaximet', 'Hạn taximet'],
  ['coTheChapKhong', 'Có thế chấp không'],
  ['nganHangTheChap', 'Ngân hàng thế chấp'],
  ['hanTheChap', 'Hạn thế chấp'],
  ['trangThaiKhoanVay', 'Trạng thái khoản vay'],
  ['kmLuyKe', 'Km lũy kế'],
  ['soChuyenThang', 'Số chuyến tháng'],
  ['canhBao', 'Ghi chú cảnh báo']
];

export const EMPTY_FILTERS = {
  donVi: '',
  doiXe: '',
  loaiXe: '',
  trangThaiXe: '',
  trangThaiNhanSu: '',
  loaiHopDong: '',
  trangThaiHopDong: '',
  trangThaiBhxh: '',
  nhomCanhBao: '',
  tuThang: '',
  denThang: ''
};

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeText(value) {
  return cleanValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.trim().slice(0, 40).toLowerCase();
      if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.');
      }
      throw new Error('Không đọc được phản hồi JSON từ API dashboard.');
    }
  }
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dashboard QLVT (${response.status}).`);
  }
  return data;
}

export async function fetchDashboardQlvt() {
  const response = await fetch('/api/dashboard-qlvt', {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  return readJsonResponse(response);
}

function matchesText(value, selected) {
  if (!cleanValue(selected)) return true;
  return normalizeText(value) === normalizeText(selected);
}

function parseMonthValue(value) {
  const text = cleanValue(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
}

function rowDateMonths(row, keys) {
  return keys
    .map((key) => parseDateValue(row?.[key]))
    .filter(Boolean)
    .map((date) => date.getFullYear() * 12 + date.getMonth() + 1);
}

function matchesMonthRange(row, keys, filters) {
  const from = parseMonthValue(filters.tuThang);
  const to = parseMonthValue(filters.denThang);
  if (!from && !to) return true;
  const months = rowDateMonths(row, keys);
  if (months.length === 0) return true;
  return months.some((month) => (!from || month >= from) && (!to || month <= to));
}

export function filterNhanSuRows(rows, filters) {
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    matchesText(row.donVi, filters.donVi) &&
    matchesText(row.doiXe, filters.doiXe) &&
    matchesText(row.trangThaiLamViec, filters.trangThaiNhanSu) &&
    matchesText(row.loaiHopDong, filters.loaiHopDong) &&
    matchesText(row.trangThaiHopDong, filters.trangThaiHopDong) &&
    matchesText(row.trangThaiBhxh, filters.trangThaiBhxh) &&
    matchesText(row.warningLevel, filters.nhomCanhBao) &&
    matchesMonthRange(row, ['ngayKyHopDong', 'ngayBatDau', 'ngayKetThuc', 'hanGplx', 'hanSucKhoe'], filters)
  )).map((row, index) => ({ ...row, stt: index + 1 }));
}

export function filterXeRows(rows, filters) {
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    matchesText(row.donViQuanLyHienTai, filters.donVi) &&
    matchesText(row.doiXe, filters.doiXe) &&
    matchesText(row.loaiXe, filters.loaiXe) &&
    matchesText(row.trangThaiXe, filters.trangThaiXe) &&
    matchesText(row.warningLevel, filters.nhomCanhBao) &&
    matchesMonthRange(row, ['hanPhuHieu', 'hanDangKiem', 'hanBaoHiemTnds', 'hanBaoHiemThanVo', 'hanTaximet', 'hanTheChap'], filters)
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

function setSheetStyles(worksheet, columnCount) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, cleanValue(cell.value).length);
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    column.width = Math.min(Math.max(maxLength + 2, 12), 34);
  });
}

export async function buildDashboardExcelWorkbook(ExcelJS, type, rows) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Không tìm thấy thư viện ExcelJS.');
  const columns = type === 'xe' ? XE_COLUMNS : NHAN_SU_COLUMNS;
  const workbook = new Workbook();
  workbook.creator = 'TAXI 123 QLVT';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(type === 'xe' ? 'Báo cáo phương tiện' : 'Báo cáo nhân sự');
  worksheet.columns = columns.map(([key, header]) => ({ key, header }));
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    worksheet.addRow({ ...row, stt: index + 1 });
  });
  setSheetStyles(worksheet, columns.length);
  return workbook;
}

export function buildDashboardExcelFileName(type) {
  const dateToken = new Date().toISOString().slice(0, 10);
  return type === 'xe'
    ? `Bao_cao_phuong_tien_QLVT_${dateToken}.xlsx`
    : `Bao_cao_nhan_su_QLVT_${dateToken}.xlsx`;
}
