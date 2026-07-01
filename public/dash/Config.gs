/**
 * ============================================================
 * QLVT DASHBOARD — Sở Xây dựng Bắc Ninh (Phòng VT&ATGT)
 * GIAI ĐOẠN 1: Khung 6 màn + Màn 1 "Tổng quan quản trị"
 * ------------------------------------------------------------
 * Config.gs — HỢP ĐỒNG DỮ LIỆU (đặt 1 chỗ, sửa ở đây nếu Sheet đổi).
 *   Mọi tên sheet / tên cột / giá trị trạng thái tập trung tại đây.
 *   Engine đọc theo TÊN CỘT (không theo vị trí) nên thêm/bớt cột
 *   ở Sheet vẫn không vỡ, miễn là tên cột không đổi.
 * ============================================================
 */

/* ID file dữ liệu QLVT. Để rỗng nếu code gắn ngay trong file đó (bound script). */
const QLVT_SPREADSHEET_ID = '';   // <-- DÁN ID FILE GOOGLE SHEET QLVT NẾU LÀ STANDALONE

const NGUONG_SAP_HET_HAN_NGAY = 30;   // "sắp hết hạn" khi còn <= 30 ngày
const CACHE_GIAY = 300;               // cache tổng hợp 5 phút

/* ---- Bảng PHƯƠNG TIỆN ---- */
const CFG_XE = {
  sheet: 'XE',
  key: 'ID_Xe', bienSo: 'BienSo', loaiXe: 'LoaiXe', nhanHieu: 'NhanHieu', soCho: 'SoCho', namSX: 'NamSanXuat',
  trangThai: 'TrangThaiXe', refDoiXe: 'Ref_DoiXe', refDonVi: 'Ref_DonViQuanLyHienTai',
  ngayHoatDong: 'NgayDuaVaoHoatDong', ngayNgung: 'NgayNgungHoatDong', lyDoNgung: 'LyDoNgung',
  TT_DANG_HOAT_DONG: 'Đang hoạt động', TT_NGUNG: 'Ngừng hoạt động'
};
const CFG_XE_XUAT_HANG  = { sheet: 'XE_XUAT_HANG', refXe: 'Ref_Xe', ngayXuat: 'NgayXuatHang' };
const CFG_PHANCONG_XE   = { sheet: 'LAIXE_PHANCONG_XE', refXe: 'Ref_Xe', refNhanSu: 'Ref_NhanSu', trangThai: 'TrangThai', TT_ACTIVE: 'Đang hiệu lực' };

/* ---- Bảng NHÂN SỰ ---- */
const CFG_NHANSU = {
  sheet: 'NHANSU',
  key: 'ID_NhanSu', hoTen: 'HoTen', gioiTinh: 'GioiTinh', ngaySinh: 'NgaySinh', loaiNhanSu: 'LoaiNhanSu',
  trangThai: 'TrangThai', refXe: 'Ref_XeHienTai', refDoiXe: 'Ref_DoiXe', refChucDanh: 'Ref_ChucDanh', refDonVi: 'Ref_DonViLamViecHienTai',
  ngayNhan: 'NgayNhanViec', ngayNghi: 'NgayNghiViec',
  TT_DANG_LAM: 'Đang làm việc', TT_TAM_NGHI: 'Tạm nghỉ', TT_NGHI_VIEC: 'Đã nghỉ việc'
};

const SO_THANG_BIEN_DONG = 6;   // cửa sổ phân tích biến động (tháng gần nhất)

/* ---- Danh mục đội xe & chức danh ---- */
const CFG_DOIXE   = { sheet: 'DM_DOIXE', key: 'ID_DoiXe', ten: 'TenDoiXe' };          // đội cũ: TenDoiXe = SỐ đội (xe trỏ vào đây)
const CFG_DOIXE_MOI = { sheet: 'DM_DOIXE_MOI', key: 'ID_DoiXe', so: 'SoDoiXe', ten: 'TenDoiXe' }; // đội mới: SoDoiXe=số, TenDoiXe=tên khu vực (nhân sự trỏ vào đây)
const CFG_CHUCDANH = { sheet: 'DM_CHUCDANH', key: 'ID_ChucDanh', ten: 'TenChucDanh' };
const CFG_DONVI    = { sheet: 'DONVI', key: 'ID_DonVi', ten: 'TenDonVi' };
const CFG_KM_THANG = { sheet: 'XE_SO_KM_THANG', refXe: 'Ref_Xe', chuyen: 'SoChuyenTrongThang', km: 'SoKmHoatDong' };

const TOP_NHAN_HIEU = 8;     // số nhãn hiệu hiển thị, còn lại gộp "Khác"
const GIOI_HAN_CANH_BAO = 300; // số dòng cảnh báo tối đa trả về

/* ---- Danh mục đội xe ---- */

/* ---- 5 hồ sơ pháp lý PHƯƠNG TIỆN (đối tượng cần có = xe đang hoạt động) ---- */
const HOSO_PHUONG_TIEN = [
  { sheet: 'XE_DANGKIEM',         nhom: 'Đăng kiểm', ref: 'Ref_Xe', expiry: 'NgayHetHan',         status: 'TrangThai',        active: 'Đang hiệu lực' },
  { sheet: 'XE_PHUHIEU',          nhom: 'Phù hiệu',  ref: 'Ref_Xe', expiry: 'NgayHetHan',         status: 'TrangThai',        active: 'Đang hiệu lực' },
  { sheet: 'XE_BAOHIEM',          nhom: 'Bảo hiểm',  ref: 'Ref_Xe', expiry: 'NgayHetHan',         status: 'TrangThaiBaoHiem', active: 'Đang hiệu lực' },
  { sheet: 'XE_TAXIMET',          nhom: 'Taximet',   ref: 'Ref_Xe', expiry: 'NgayHetHanKiemDinh', status: 'TrangThai',        active: 'Đang hiệu lực' },
  { sheet: 'XE_THECHAP_NGANHANG', nhom: 'Thế chấp',  ref: 'Ref_Xe', expiry: 'NgayHetHan',         status: 'TrangThaiTheChap', active: 'Đang thế chấp' }
];

/* ---- 5 hồ sơ pháp lý NHÂN SỰ (đối tượng cần có = nhân sự đang làm việc) ---- */
const HOSO_NHAN_SU = [
  { sheet: 'LAIXE_GPLX',             nhom: 'GPLX',          ref: 'Ref_NhanSu', expiry: 'NgayHetHan',          status: 'TrangThai',     active: 'Đang hiệu lực' },
  { sheet: 'NHANSU_SUCKHOE',         nhom: 'Khám sức khỏe', ref: 'Ref_NhanSu', expiry: 'NgayHetHan',          status: 'TrangThai',     active: 'Đang hiệu lực' },
  { sheet: 'NHANSU_HOPDONG_LAODONG', nhom: 'HĐLĐ',          ref: 'Ref_NhanSu', expiry: 'NgayKetThuc',         status: 'TrangThai',     active: 'Đang hiệu lực' },
  { sheet: 'NHANSU_BHXH',            nhom: 'BHXH',          ref: 'Ref_NhanSu', expiry: 'NgayKetThucThamGia',  status: 'TrangThaiBHXH', active: 'Đang tham gia' },
  { sheet: 'LAIXE_DAOTAO',           nhom: 'Đào tạo',       ref: 'Ref_NhanSu', expiry: 'NgayHetHan',          status: 'TrangThai',     active: 'Đang hiệu lực' }
];

/* ============================================================
 * CHẨN ĐOÁN DỮ LIỆU — chạy 1 lần để xác nhận sheet/cột khớp.
 * Mở Apps Script → chọn hàm chanDoanDuLieu → Run → xem Log.
 * ============================================================ */
function chanDoanDuLieu() {
  const kq = chanDoanDuLieu_();
  Logger.log('===== CHẨN ĐOÁN DỮ LIỆU QLVT =====');
  kq.forEach(function (x) {
    Logger.log('%s | sheet:%s | dòng:%s | cột thiếu:%s',
      x.ok ? 'OK ' : 'LỖI', x.sheet, x.soDong, x.cotThieu.length ? x.cotThieu.join(', ') : '(không)');
  });
  return kq;
}

function chanDoanDuLieu_() {
  const checks = [];
  const add = function (cfg, cols) { checks.push({ sheet: cfg.sheet, cols: cols }); };
  add(CFG_XE, [CFG_XE.key, CFG_XE.bienSo, CFG_XE.trangThai, CFG_XE.loaiXe, CFG_XE.namSX, CFG_XE.refDoiXe]);
  add(CFG_NHANSU, [CFG_NHANSU.key, CFG_NHANSU.hoTen, CFG_NHANSU.trangThai, CFG_NHANSU.gioiTinh, CFG_NHANSU.refXe]);
  add(CFG_XE_XUAT_HANG, [CFG_XE_XUAT_HANG.refXe]);
  add(CFG_PHANCONG_XE, [CFG_PHANCONG_XE.refXe, CFG_PHANCONG_XE.trangThai]);
  add(CFG_DOIXE, [CFG_DOIXE.key, CFG_DOIXE.ten]);
  HOSO_PHUONG_TIEN.concat(HOSO_NHAN_SU).forEach(function (h) { add({ sheet: h.sheet }, [h.ref, h.expiry, h.status]); });

  const ss = qlvtSS_();
  return checks.map(function (c) {
    const sh = ss.getSheetByName(c.sheet);
    if (!sh) return { ok: false, sheet: c.sheet, soDong: 0, cotThieu: c.cols };
    const headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    const thieu = c.cols.filter(function (col) { return findColByName_(headers, col) < 0; });
    return { ok: thieu.length === 0, sheet: c.sheet, soDong: Math.max(0, sh.getLastRow() - 1), cotThieu: thieu };
  });
}
