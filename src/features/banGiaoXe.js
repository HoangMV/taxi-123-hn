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

function getNhanSuDisplayName(nhanSu) {
  if (!nhanSu) return '';
  return cleanValue(nhanSu.HoTen) || cleanValue(nhanSu.Display) || cleanValue(nhanSu.ID_NhanSu);
}

function buildNhanSuSelector(ids) {
  const uniqueIds = [...new Set(ids.map(cleanValue).filter(Boolean))];
  if (uniqueIds.length === 0) return '';

  const listValues = uniqueIds.map((id) => `"${escapeSelectorValue(id)}"`).join(', ');
  return `Filter(NHANSU, IN([ID_NhanSu], LIST(${listValues})))`;
}

async function fetchNhanSuByIds(appSheetService, ids) {
  const selector = buildNhanSuSelector(ids);
  if (!selector) return new Map();

  const rows = await appSheetService.find('NHANSU', selector);
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [cleanValue(row?.ID_NhanSu), row])
      .filter(([id]) => id)
  );
}

export function buildBanGiaoXePayload(row, relatedData = {}) {
  const ngayBanGiao = formatAdministrativeDate(row?.NgayBanGiao);
  const nhanSuById = relatedData.nhanSuById || new Map();
  const daiDienBenGiao1Id = cleanValue(row?.DaiDienBenGiao1);
  const daiDienBenGiao2Id = cleanValue(row?.DaiDienBenGiao2);
  const laiXeId = cleanValue(row?.Ref_LaiXe);
  const daiDienBenGiao1 = nhanSuById.get(daiDienBenGiao1Id);
  const daiDienBenGiao2 = nhanSuById.get(daiDienBenGiao2Id);
  const laiXe = nhanSuById.get(laiXeId);

  return {
    raw: row,
    idBienBanXe: cleanValue(row?.ID_BienBanXe),
    soBienBan: cleanValue(row?.SoBienBan),
    ngayBanGiao,
    ngayBanGiaoText: formatAdministrativeDateString(row?.NgayBanGiao),
    tenBenGiao: cleanValue(row?.TenBenGiao),
    daiDienBenGiao1Id,
    daiDienBenGiao1: getNhanSuDisplayName(daiDienBenGiao1) || daiDienBenGiao1Id,
    chucVuBenGiao1: cleanValue(row?.ChucVuBenGiao1),
    daiDienBenGiao2Id,
    daiDienBenGiao2: getNhanSuDisplayName(daiDienBenGiao2) || daiDienBenGiao2Id,
    chucVuBenGiao2: cleanValue(row?.ChucVuBenGiao2),
    laiXeId,
    hoTenLaiXe: getNhanSuDisplayName(laiXe) || cleanValue(row?.HoTenLaiXe),
    soCccd: cleanValue(laiXe?.CCCD) || cleanValue(row?.SoCCCD),
    soGplx: cleanValue(laiXe?.SoGPLX) || cleanValue(row?.SoGPLX),
    hanGplx: formatAdministrativeDateString(laiXe?.HanGPLX || row?.HanGPLX),
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

  const nhanSuById = await fetchNhanSuByIds(appSheetService, [
    row.DaiDienBenGiao1,
    row.DaiDienBenGiao2,
    row.Ref_LaiXe
  ]);

  return buildBanGiaoXePayload(row, { nhanSuById });
}
