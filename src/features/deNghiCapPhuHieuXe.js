import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const TABLE_HO_SO = 'HS_DE_NGHI_PHUHIEU';
const TABLE_CHI_TIET = 'CT_HS_DE_NGHI_PHUHIEU';
const TABLE_DON_VI = 'DONVI';
const TABLE_CO_QUAN_CAP = 'DM_COQUAN_CAP';
const TABLE_XE = 'XE';

export function getDeNghiCapPhuHieuIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoPhuHieu') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map(cleanValue).filter(Boolean))];
  if (uniqueIds.length === 0) return '';
  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(${tableName}, IN([${keyName}], LIST(${listValues})))`;
}

function buildMap(rows, keyName) {
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [cleanValue(row?.[keyName]), row])
      .filter(([id]) => id)
  );
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || cleanValue(donVi.ID_DonVi);
}

function getDonViDiaDanh(donVi) {
  const tinhThanh = cleanValue(donVi?.TinhThanh);
  if (tinhThanh) return tinhThanh.replace(/^(tỉnh|thành phố|tp\.?|tx\.?|thị xã)\s+/i, '');

  const diaChi = cleanValue(donVi?.DiaChi);
  if (!diaChi) return '';

  const parts = diaChi
    .split(',')
    .map((part) => cleanValue(part))
    .filter(Boolean);

  return (parts[parts.length - 1] || '').replace(/^(tỉnh|thành phố|tp\.?|tx\.?|thị xã)\s+/i, '');
}

function getCoQuanDisplayName(coQuan) {
  if (!coQuan) return '';
  return cleanValue(coQuan.TenCoQuanCap) || cleanValue(coQuan.Display) || cleanValue(coQuan.ID_CoQuanCap);
}

function buildXeItems(chiTietRows, xeById, hoSoRow) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const xe = xeById.get(cleanValue(row?.Ref_Xe));

    return {
      stt: String(index + 1),
      bienSo: cleanValue(xe?.BienSo) || cleanValue(row?.BienSo) || cleanValue(row?.Ref_Xe),
      sucChua: cleanValue(xe?.SoCho),
      nhanHieu: cleanValue(xe?.NhanHieu),
      nuocSanXuat: cleanValue(xe?.NuocSX),
      namSanXuat: cleanValue(xe?.NamSanXuat),
      loaiPhuHieu: cleanValue(row?.LoaiPhuHieu) || cleanValue(hoSoRow?.LoaiPhuHieu),
      phuongThucTinhTien: cleanValue(hoSoRow?.PhuongThucTinhTien)
    };
  });
}

export async function fetchDeNghiCapPhuHieuRow(appSheetService, idHoSoPhuHieu) {
  if (!idHoSoPhuHieu) {
    throw new Error('Thiếu tham số ID_HoSoPhuHieu trên URL.');
  }

  const selector = buildEqualsSelector(TABLE_HO_SO, 'ID_HoSoPhuHieu', idHoSoPhuHieu);
  const rows = await appSheetService.find(TABLE_HO_SO, selector);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy hồ sơ đề nghị cấp phù hiệu với ID_HoSoPhuHieu = ${idHoSoPhuHieu}.`);
  }

  return row;
}

async function fetchMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchDeNghiCapPhuHieuRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      chiTietRows: [],
      donViById: new Map(),
      coQuanCapById: new Map(),
      xeById: new Map()
    };
  }

  const chiTietRows = await appSheetService.find(
    TABLE_CHI_TIET,
    buildEqualsSelector(TABLE_CHI_TIET, 'Ref_HoSoPhuHieu', row?.ID_HoSoPhuHieu)
  );

  const [donViById, coQuanCapById, xeById] = await Promise.all([
    fetchMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', [row?.Ref_DonViDeNghi]),
    fetchMap(appSheetService, TABLE_CO_QUAN_CAP, 'ID_CoQuanCap', [row?.Ref_CoQuanCap]),
    fetchMap(
      appSheetService,
      TABLE_XE,
      'ID_Xe',
      (Array.isArray(chiTietRows) ? chiTietRows : []).map((chiTiet) => chiTiet?.Ref_Xe)
    )
  ]);

  return {
    chiTietRows: Array.isArray(chiTietRows) ? chiTietRows : [],
    donViById,
    coQuanCapById,
    xeById
  };
}

export function buildDeNghiCapPhuHieuPayload(row, relatedData = {}) {
  const donViById = relatedData.donViById || new Map();
  const coQuanCapById = relatedData.coQuanCapById || new Map();
  const xeById = relatedData.xeById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];

  const donVi = donViById.get(cleanValue(row?.Ref_DonViDeNghi));
  const coQuanCap = coQuanCapById.get(cleanValue(row?.Ref_CoQuanCap));
  const danhSachXe = buildXeItems(chiTietRows, xeById, row);
  const ngayLap = formatAdministrativeDate(row?.NgayLap);
  const soHoSo = cleanValue(row?.SoHoSo);
  const tenDonVi = getDonViDisplayName(donVi);

  return {
    raw: row,
    idHoSoPhuHieu: cleanValue(row?.ID_HoSoPhuHieu),
    soHoSo,
    ngayLap,
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    diaDanhLapDon: getDonViDiaDanh(donVi),
    tenCoQuanCap: getCoQuanDisplayName(coQuanCap),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    soDienThoai: cleanValue(donVi?.SoDienThoai),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue),
    nguoiDaiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    nguoiDaiDienDonViUpper: cleanValue(donVi?.NguoiDaiDien).toUpperCase(),
    chucVuNguoiDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    loaiPhuHieu: cleanValue(row?.LoaiPhuHieu),
    hinhThucCap: cleanValue(row?.HinhThucCap),
    phuongThucTinhTien: cleanValue(row?.PhuongThucTinhTien),
    danhSachXe,
    soLuongDeNghiCap: danhSachXe.length
  };
}

export function buildDeNghiCapPhuHieuTemplateData(payload, soLuongNopLai) {
  return {
    so_ho_so: payload.soHoSo,
    dia_danh_lap_don: payload.diaDanhLapDon,
    ngay_lap_day: payload.ngayLap.day,
    ngay_lap_month: payload.ngayLap.month,
    ngay_lap_year: payload.ngayLap.year,
    ten_co_quan_cap: payload.tenCoQuanCap,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    so_dien_thoai: payload.soDienThoai,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    nguoi_dai_dien_don_vi: payload.nguoiDaiDienDonVi,
    nguoi_dai_dien_don_vi_upper: payload.nguoiDaiDienDonViUpper,
    chuc_vu_nguoi_dai_dien: payload.chucVuNguoiDaiDien,
    loai_phu_hieu_ho_so: payload.loaiPhuHieu,
    hinh_thuc_cap: payload.hinhThucCap,
    phuong_thuc_tinh_tien: payload.phuongThucTinhTien,
    so_luong_nop_lai: cleanValue(soLuongNopLai),
    so_luong_de_nghi_cap: String(payload.soLuongDeNghiCap || 0),
    danh_sach_xe: payload.danhSachXe.map((item) => ({
      stt: item.stt,
      bien_so: item.bienSo,
      suc_chua: item.sucChua,
      nhan_hieu: item.nhanHieu,
      nuoc_san_xuat: item.nuocSanXuat,
      nam_san_xuat: item.namSanXuat,
      loai_phu_hieu: item.loaiPhuHieu,
      phuong_thuc_tinh_tien: item.phuongThucTinhTien
    }))
  };
}
