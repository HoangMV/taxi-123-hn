export const NHAN_SU_COLUMNS = [
  ['stt', 'STT'],
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
  ['ngayCapGplx', 'Ngày cấp GPLX'],
  ['hanGplx', 'Hạn GPLX'],
  ['ngayCapGksk', 'Ngày cấp GKSK'],
  ['hanSucKhoe', 'Hạn sức khỏe'],
  ['thoiGianTapHuan', 'Thời gian tập huấn'],
  ['ngayCapGcnTapHuan', 'Ngày cấp GCN tập huấn'],
  ['ngayHetHanGcn', 'Ngày hết hạn GCN'],
  ['ngayKyThoaThuan', 'Ngày ký thoả thuận'],
  ['ngayKetThucThoaThuan', 'Ngày kết thúc thoả thuận'],
  ['soSoBhxh', 'Số sổ BHXH'],
  ['maSoBhxh', 'Mã số BHXH'],
  ['trangThaiBhxh', 'Trạng thái BHXH'],
  ['mucLuongDongBhxh', 'Mức lương đóng BHXH'],
  ['hoTenNguoiBaoLanh', 'Họ tên người bảo lãnh'],
  ['sdtNguoiBaoLanh', 'SĐT người bảo lãnh'],
  ['canhBao', 'Ghi chú cảnh báo']
];

export const XE_COLUMNS = [
  ['stt', 'STT'],
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
  gioiTinh: '',
  loaiHopDong: '',
  trangThaiHopDong: '',
  trangThaiBhxh: '',
  nhomCanhBao: '',
  loaiGiayTo: '',
  tinhTrangHan: '',
  chucDanh: '',
  nhomTrangThaiNhanSu: '',
  nhomTrangThaiXe: '',
  tuNgay: '',
  denNgay: ''
};

// Các loại giấy tờ có hạn theo từng nhóm, dùng cho bộ lọc "theo từng loại".
export const LOAI_GIAY_TO_NHAN_SU = ['Hợp đồng lao động', 'GPLX', 'Sức khỏe'];
export const LOAI_GIAY_TO_XE = ['Phù hiệu', 'Đăng kiểm', 'Bảo hiểm', 'Bảo hiểm TNDS', 'Bảo hiểm thân vỏ', 'Taximet', 'Thế chấp'];

// Các mức tình trạng hạn cho bộ lọc nhanh.
// 'canh-bao' = quá hạn HOẶC sắp hết hạn (khớp với số trên card KPI giấy tờ).
export const TINH_TRANG_HAN_OPTIONS = [
  { value: 'canh-bao', label: 'Quá hạn / sắp hết hạn' },
  { value: 'qua-han', label: 'Đã quá hạn' },
  { value: 'sap-15', label: 'Sắp hết hạn ≤ 15 ngày' },
  { value: 'sap-30', label: 'Sắp hết hạn ≤ 30 ngày' },
  { value: 'con-hieu-luc', label: 'Còn hiệu lực' }
];

// Ngưỡng "sắp hết hạn" mặc định (ngày) — khớp backend DASHBOARD_WARNING_DAYS.
export const NGUONG_SAP_HET_HAN_NGAY = 30;

// Số tháng phân tích biến động (cửa sổ gần nhất).
export const SO_THANG_BIEN_DONG = 6;

// Nhóm hồ sơ pháp lý theo từng loại đối tượng — dùng để tính tuân thủ & cảnh báo.
// name: trùng warningItems.name backend trả; nhan: nhãn hiển thị.
export const NHOM_HOSO_PHUONG_TIEN = [
  { name: 'Đăng kiểm', nhan: 'Đăng kiểm' },
  { name: 'Phù hiệu', nhan: 'Phù hiệu' },
  { name: 'Bảo hiểm TNDS', nhan: 'Bảo hiểm TNDS' },
  { name: 'Bảo hiểm thân vỏ', nhan: 'Bảo hiểm thân vỏ' },
  { name: 'Taximet', nhan: 'Taximet' },
  { name: 'Thế chấp', nhan: 'Thế chấp' }
];

export const NHOM_HOSO_NHAN_SU = [
  { name: 'Hợp đồng lao động', nhan: 'HĐLĐ' },
  { name: 'GPLX', nhan: 'GPLX' },
  { name: 'Sức khỏe', nhan: 'Khám sức khỏe' }
];
