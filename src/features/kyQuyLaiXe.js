import {
  calculateInclusiveEndDate,
  formatAdministrativeDate,
  formatAdministrativeDateString
} from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

export function getKyQuyIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_KyQuy') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatMoney(value) {
  const digits = String(value ?? '').replace(/[^\d-]/g, '');
  if (!digits) return '';
  const numericValue = Number(digits);
  if (!Number.isFinite(numericValue)) return cleanValue(value);
  return new Intl.NumberFormat('vi-VN').format(numericValue);
}

function getNhanSuDisplayName(nhanSu) {
  if (!nhanSu) return '';
  return cleanValue(nhanSu.HoTen) || cleanValue(nhanSu.Display) || cleanValue(nhanSu.ID_NhanSu);
}

function getDonViRefId(row) {
  return cleanValue(row?.Ref_DonViQuanLyHienTai) || cleanValue(row?.Ref_DonVi);
}

function buildMap(rows, keyName) {
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [cleanValue(row?.[keyName]), row])
      .filter(([id]) => id)
  );
}

async function fetchKyQuyBundle(idKyQuy, options = {}) {
  const params = new URLSearchParams({
    ID_KyQuy: idKyQuy
  });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const response = await fetch(`/api/ky-quy-lai-xe?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/ky-quy-lai-xe chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu ký quỹ lái xe (${response.status}).`);
  }

  return data;
}

export async function fetchKyQuyRow(idKyQuy) {
  if (!idKyQuy) {
    throw new Error('Thiếu tham số ID_KyQuy trên URL.');
  }

  const bundle = await fetchKyQuyBundle(idKyQuy, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_KyQuy = ${idKyQuy}.`);
  }
  return row;
}

export function getKyQuyRelatedIds(row) {
  return {
    nhanSuIds: [row?.Ref_NhanSu],
    donViIds: [getDonViRefId(row)]
  };
}

export async function fetchKyQuyRelated(row) {
  const id = cleanValue(row?.ID_KyQuy);
  if (!id) return {
    nhanSuById: new Map(),
    donViById: new Map()
  };
  const bundle = await fetchKyQuyBundle(id, { });
  const related = bundle.related || {};
  return {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi')
  };
}

export function buildKyQuyPayload(row, relatedData = {}) {
  const ngayKy = formatAdministrativeDate(row?.NgayKyHopDong);
  const ngayHetHanDate = calculateInclusiveEndDate(row?.NgayKyHopDong, 365);
  const ngayHetHan = formatAdministrativeDate(ngayHetHanDate);
  const nhanSuById = relatedData.nhanSuById || new Map();
  const donViById = relatedData.donViById || new Map();
  const nhanSuId = cleanValue(row?.Ref_NhanSu);
  const donViId = getDonViRefId(row);
  const nhanSu = nhanSuById.get(nhanSuId);
  const donVi = donViById.get(donViId);
  const soTienPhaiNop = cleanValue(row?.SoTienPhaiNop);
  const soTienDaNop = cleanValue(row?.SoTienDaNop);
  const soTienConLai = cleanValue(row?.SoTienConLai);
  const soCccd = cleanValue(nhanSu?.CCCD) || cleanValue(row?.SoCCCD);

  return {
    raw: row,
    idKyQuy: cleanValue(row?.ID_KyQuy),
    soHopDong: cleanValue(row?.MaKyQuy),
    ngayKy,
    ngayKyText: formatAdministrativeDateString(row?.NgayKyHopDong),
    ngayHetHan,
    ngayHetHanText: formatAdministrativeDateString(ngayHetHanDate),
    trangThaiKyQuy: cleanValue(row?.TrangThai),
    nhanSuId,
    donViId,
    hoTenLaiXe: getNhanSuDisplayName(nhanSu) || nhanSuId,
    soCccd,
    ngayCapCccd: formatAdministrativeDateString(nhanSu?.NgayCapCCCD),
    noiCapCccd: cleanValue(nhanSu?.NoiCapCCCD),
    diaChiDayDu: cleanValue(nhanSu?.Dia_Chi_Day_Du) || cleanValue(nhanSu?.Address),
    soDienThoai: cleanValue(nhanSu?.SoDienThoai),
    soGplx: cleanValue(nhanSu?.SoGPLX),
    hanGplx: formatAdministrativeDateString(nhanSu?.HanGPLX),
    tenDonVi: cleanValue(donVi?.TenDonVi),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue) || cleanValue(donVi?.MaDonVi),
    nguoiDaiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    soTienPhaiNop,
    soTienPhaiNopText: formatMoney(soTienPhaiNop),
    soTienPhaiNopBangChu: numberToVietnameseWords(soTienPhaiNop),
    soTienDaNop,
    soTienDaNopText: formatMoney(soTienDaNop),
    soTienConLai,
    soTienConLaiText: formatMoney(soTienConLai)
  };
}

export function buildKyQuyTemplateData(payload) {
  return {
    so_hop_dong: payload.soHopDong,
    ngay_ky: payload.ngayKy.day,
    thang_ky: payload.ngayKy.month,
    nam_ky: payload.ngayKy.year,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_uper: (payload.tenDonVi || '').toUpperCase(),
    dia_chi_don_vi: payload.diaChiDonVi,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    nguoi_dai_dien_don_vi: payload.nguoiDaiDienDonVi,
    chuc_vu_nguoi_dai_dien: payload.chucVuNguoiDaiDien,
    ho_ten_lai_xe: payload.hoTenLaiXe,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    dia_chi_day_du: payload.diaChiDayDu,
    so_dien_thoai: payload.soDienThoai,
    so_tien_phai_nop: payload.soTienPhaiNopText,
    so_tien_phai_nop_text: payload.soTienPhaiNopBangChu,
    ngay_hieu_luc_text: payload.ngayKyText,
    ngay_het_han_text: payload.ngayHetHanText,
    so_tien_da_nop: payload.soTienDaNopText,
    so_tien_con_lai: payload.soTienConLaiText,
    trang_thai_ky_quy: payload.trangThaiKyQuy
  };
}

export async function fetchKyQuyData(idKyQuy) {
  if (!idKyQuy) {
    throw new Error('Thiếu tham số ID_KyQuy trên URL.');
  }

  const bundle = await fetchKyQuyBundle(idKyQuy);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_KyQuy = ${idKyQuy}.`);
  }
  const related = bundle.related || {};
  return buildKyQuyPayload(row, {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi')
  });
}
