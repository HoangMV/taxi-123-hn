import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export function getBanGiaoXeIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_BienBanXe') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

export function buildBanGiaoXePayload(row) {
  const ngayBanGiao = formatAdministrativeDate(row?.NgayBanGiao);

  return {
    raw: row,
    idBienBanXe: cleanValue(row?.ID_BienBanXe),
    soBienBan: cleanValue(row?.SoBienBan),
    ngayBanGiao,
    ngayBanGiaoText: formatAdministrativeDateString(row?.NgayBanGiao),
    tenBenGiao: cleanValue(row?.TenBenGiao),
    daiDienBenGiao1: cleanValue(row?.DaiDienBenGiao1),
    chucVuBenGiao1: cleanValue(row?.ChucVuBenGiao1),
    daiDienBenGiao2: cleanValue(row?.DaiDienBenGiao2),
    chucVuBenGiao2: cleanValue(row?.ChucVuBenGiao2),
    hoTenLaiXe: cleanValue(row?.HoTenLaiXe),
    soCccd: cleanValue(row?.SoCCCD),
    soGplx: cleanValue(row?.SoGPLX),
    hanGplx: formatAdministrativeDateString(row?.HanGPLX),
    bienSoXe: cleanValue(row?.BienSoXe),
    maDam: cleanValue(row?.MaDam),
    soKhung: cleanValue(row?.SoKhung),
    soMay: cleanValue(row?.SoMay),
    nhanHieuXe: cleanValue(row?.NhanHieuXe),
    namSanXuat: cleanValue(row?.NamSanXuat),
    trangThaiQuanLyXe: cleanValue(row?.TrangThaiQuanLyXe),
    trangThaiBienBan: cleanValue(row?.TrangThaiBienBan)
  };
}

export function buildBanGiaoXeTemplateData(payload) {
  return {
    so_bien_ban: payload.soBienBan,
    ngay_ban_giao: payload.ngayBanGiao.day,
    thang_ban_giao: payload.ngayBanGiao.month,
    nam_ban_giao: payload.ngayBanGiao.year,
    ten_ben_giao: payload.tenBenGiao,
    dai_dien_ben_giao_1: payload.daiDienBenGiao1,
    chuc_vu_ben_giao_1: payload.chucVuBenGiao1,
    dai_dien_ben_giao_2: payload.daiDienBenGiao2,
    chuc_vu_ben_giao_2: payload.chucVuBenGiao2,
    ho_ten_lai_xe: payload.hoTenLaiXe,
    so_cccd: payload.soCccd,
    so_gplx: payload.soGplx,
    han_gplx: payload.hanGplx,
    bien_so_xe: payload.bienSoXe,
    ma_dam: payload.maDam,
    so_khung: payload.soKhung,
    so_may: payload.soMay,
    nhan_hieu_xe: payload.nhanHieuXe,
    nam_san_xuat: payload.namSanXuat
  };
}

export async function fetchBanGiaoXeData(appSheetService, idBienBanXe) {
  if (!idBienBanXe) {
    throw new Error('Thiếu tham số ID_BienBanXe trên URL.');
  }

  const selectorValue = escapeSelectorValue(idBienBanXe);
  const rows = await appSheetService.find('XE_BANGIAO', `Filter(XE_BANGIAO, [ID_BienBanXe] = "${selectorValue}")`);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy biên bản bàn giao xe với ID_BienBanXe = ${idBienBanXe}.`);
  }

  return buildBanGiaoXePayload(row);
}
