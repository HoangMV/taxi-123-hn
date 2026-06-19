import { formatAdministrativeDate, formatAdministrativeDateString, parseDateValue } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

export function getThanhLyKyQuyIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ThanhLy') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildMap(rows, keyName) {
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [cleanValue(row?.[keyName]), row])
      .filter(([id]) => id)
  );
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

function getNhanSuAddress(nhanSu) {
  return cleanValue(nhanSu?.Dia_Chi_Day_Du) || cleanValue(nhanSu?.Address);
}

function getDonViRefId(kyQuy) {
  return cleanValue(kyQuy?.Ref_DonViQuanLyHienTai) || cleanValue(kyQuy?.Ref_DonVi);
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || cleanValue(donVi.ID_DonVi);
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

export function pickThanhLyHopDong(rows, ngayLap) {
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

async function fetchThanhLyKyQuyBundle(idThanhLy, options = {}) {
  const params = new URLSearchParams({
    ID_ThanhLy: idThanhLy
  });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const response = await fetch(`/api/thanh-ly-ky-quy-lai-xe?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/thanh-ly-ky-quy-lai-xe chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu thanh lý ký quỹ (${response.status}).`);
  }

  return data;
}

export async function fetchThanhLyKyQuyRow(idThanhLy) {
  if (!idThanhLy) {
    throw new Error('Thiếu tham số ID_ThanhLy trên URL.');
  }

  const bundle = await fetchThanhLyKyQuyBundle(idThanhLy, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ThanhLy = ${idThanhLy}.`);
  }
  return row;
}

export async function fetchThanhLyKyQuyRelated(row) {
  const id = cleanValue(row?.ID_ThanhLy);
  if (!id) return {
    kyQuyById: new Map(),
    nhanSuById: new Map(),
    donViById: new Map(),
    thanhLyHopDongRows: [],
    hopDongLaoDongById: new Map()
  };
  const bundle = await fetchThanhLyKyQuyBundle(id, { });
  const related = bundle.related || {};
  return {
    kyQuyById: buildMap(related.NHANSU_KYQUY, 'ID_KyQuy'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    thanhLyHopDongRows: Array.isArray(related.NHANSU_THANHLY_HOPDONG) ? related.NHANSU_THANHLY_HOPDONG : [],
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong')
  };
}

export function buildThanhLyKyQuyPayload(row, relatedData = {}) {
  const kyQuyById = relatedData.kyQuyById || new Map();
  const nhanSuById = relatedData.nhanSuById || new Map();
  const donViById = relatedData.donViById || new Map();
  const thanhLyHopDongRows = relatedData.thanhLyHopDongRows || [];
  const hopDongLaoDongById = relatedData.hopDongLaoDongById || new Map();
  const kyQuyId = cleanValue(row?.Ref_KyQuy);
  const kyQuy = kyQuyById.get(kyQuyId);
  const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
  const donViId = getDonViRefId(kyQuy);
  const nhanSu = nhanSuById.get(nhanSuId);
  const donVi = donViById.get(donViId);
  const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row?.NgayLap);
  const hopDongLaoDong = hopDongLaoDongById.get(cleanValue(thanhLyHopDong?.Ref_HopDongLD));
  const ngayLap = formatAdministrativeDate(row?.NgayLap);
  const soTienHoanTra = cleanValue(row?.SoTienHoanTra) || cleanValue(kyQuy?.SoTienHoanTra);
  const soTienKhauTru = cleanValue(row?.SoTienKhauTru) || cleanValue(kyQuy?.SoTienKhauTru);
  const soTienConLai = cleanValue(row?.SoTienKyQuyConLai) || cleanValue(kyQuy?.SoTienConLai);
  const tenNhanSu = cleanValue(row?.TenNhanSu) || getNhanSuDisplayName(nhanSu) || nhanSuId;
  const tenDonVi = cleanValue(row?.TenDonVi) || getDonViDisplayName(donVi);
  const soHopDongDatCoc = cleanValue(row?.SoHopDongDatCoc) || cleanValue(kyQuy?.MaKyQuy) || kyQuyId;
  const ngayKyHopDong = cleanValue(row?.NgayKyHopDong) || cleanValue(kyQuy?.NgayKyHopDong);
  const soHopDongLaoDong = cleanValue(hopDongLaoDong?.SoHopDong) || cleanValue(thanhLyHopDong?.Ref_HopDongLD);
  const ngayKyHopDongLaoDong = cleanValue(hopDongLaoDong?.NgayKy);
  const ngayChamDut = cleanValue(thanhLyHopDong?.NgayChamDut) || cleanValue(row?.NgayChamDut);

  return {
    raw: row,
    rawKyQuy: kyQuy || null,
    rawThanhLyHopDong: thanhLyHopDong || null,
    rawHopDongLaoDong: hopDongLaoDong || null,
    idThanhLy: cleanValue(row?.ID_ThanhLy),
    soBienBan: cleanValue(row?.SoBienBan),
    ngayLap,
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    kyQuyId,
    nhanSuId,
    donViId,
    tenNhanSu,
    diaChiNhanSu: cleanValue(row?.DiaChiNhanSu) || getNhanSuAddress(nhanSu),
    soCccd: cleanValue(row?.SoCCCD) || cleanValue(kyQuy?.SoCCCD) || cleanValue(nhanSu?.CCCD),
    ngayCapCccd: formatAdministrativeDateString(row?.NgayCapCCCD || nhanSu?.NgayCapCCCD),
    noiCapCccd: cleanValue(row?.NoiCapCCCD) || cleanValue(nhanSu?.NoiCapCCCD),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(row?.DiaChiDonVi) || cleanValue(donVi?.DiaChi),
    maSoThueDonVi: cleanValue(row?.MaSoThueDonVi) || cleanValue(donVi?.MaSoThue) || cleanValue(donVi?.MaDonVi),
    daiDienDonVi: cleanValue(row?.DaiDienDonVi) || cleanValue(donVi?.NguoiDaiDien),
    chucVuDaiDien: cleanValue(row?.ChucVuDaiDien) || cleanValue(donVi?.ChucVuNguoiDaiDien),
    soHopDongDatCoc,
    ngayKyHopDongDatCoc: formatAdministrativeDateString(ngayKyHopDong),
    lyDoThanhLy: cleanValue(row?.LyDoThanhLy) || cleanValue(thanhLyHopDong?.LyDoThanhLy),
    soTienKyQuyConLai: soTienConLai,
    soTienKyQuyConLaiText: formatMoney(soTienConLai),
    soTienKhauTru,
    soTienKhauTruText: formatMoney(soTienKhauTru),
    soTienHoanTra,
    soTienHoanTraText: formatMoney(soTienHoanTra),
    soTienHoanTraBangChu: numberToVietnameseWords(soTienHoanTra),
    hinhThucThanhToan: cleanValue(row?.HinhThucThanhToan),
    trangThaiThanhLy: cleanValue(row?.TrangThaiThanhLy),
    soHopDongLaoDong,
    ngayKyHopDongLaoDong: formatAdministrativeDateString(ngayKyHopDongLaoDong),
    ngayChamDutText: formatAdministrativeDateString(ngayChamDut)
  };
}

function hasPayloadValue(value) {
  return cleanValue(value) !== '';
}

function hasPayloadDateParts(value) {
  return hasPayloadValue(value?.day) && hasPayloadValue(value?.month) && hasPayloadValue(value?.year);
}

export function shouldFetchThanhLyKyQuyRelated(payload) {
  if (!payload) return true;

  const requiredPreviewFields = [
    payload.soBienBan,
    payload.tenDonVi,
    payload.tenDonViUpper,
    payload.diaChiDonVi,
    payload.maSoThueDonVi,
    payload.daiDienDonVi,
    payload.tenNhanSu,
    payload.diaChiNhanSu,
    payload.soCccd,
    payload.ngayCapCccd,
    payload.noiCapCccd,
    payload.soHopDongDatCoc,
    payload.ngayKyHopDongDatCoc,
    payload.lyDoThanhLy,
    payload.soTienKyQuyConLaiText,
    payload.soTienKhauTruText,
    payload.soTienHoanTraText,
    payload.soTienHoanTraBangChu
  ];

  return !hasPayloadDateParts(payload.ngayLap) || requiredPreviewFields.some((value) => !hasPayloadValue(value));
}

export function buildThanhLyKyQuyTemplateData(payload) {
  return {
    so_bien_ban: payload.soBienBan,
    ngay_lap: payload.ngayLap.day,
    thang_lap: payload.ngayLap.month,
    nam_lap: payload.ngayLap.year,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    TEN_DON_VI_UPPER: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    dai_dien_don_vi: payload.daiDienDonVi,
    chuc_vu_dai_dien: payload.chucVuDaiDien,
    ho_ten_lai_xe: payload.tenNhanSu,
    dia_chi_lai_xe: payload.diaChiNhanSu,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    so_hop_dong_dat_coc: payload.soHopDongDatCoc,
    ngay_ky_hop_dong_dat_coc: payload.ngayKyHopDongDatCoc,
    ly_do_thanh_ly: payload.lyDoThanhLy,
    so_tien_ky_quy_con_lai: payload.soTienKyQuyConLaiText,
    so_tien_khau_tru: payload.soTienKhauTruText,
    so_tien_hoan_tra: payload.soTienHoanTraText,
    so_tien_hoan_tra_text: payload.soTienHoanTraBangChu,
    hinh_thuc_thanh_toan: payload.hinhThucThanhToan,
    so_hop_dong_lao_dong: payload.soHopDongLaoDong,
    ngay_ky_hop_dong_lao_dong: payload.ngayKyHopDongLaoDong,
    ngay_cham_dut: payload.ngayChamDutText,
    trang_thai_thanh_ly: payload.trangThaiThanhLy
  };
}

export async function fetchThanhLyKyQuyData(idThanhLy) {
  if (!idThanhLy) {
    throw new Error('Thiếu tham số ID_ThanhLy trên URL.');
  }

  const bundle = await fetchThanhLyKyQuyBundle(idThanhLy);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ThanhLy = ${idThanhLy}.`);
  }
  const related = bundle.related || {};
  return buildThanhLyKyQuyPayload(row, {
    kyQuyById: buildMap(related.NHANSU_KYQUY, 'ID_KyQuy'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    thanhLyHopDongRows: Array.isArray(related.NHANSU_THANHLY_HOPDONG) ? related.NHANSU_THANHLY_HOPDONG : [],
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong')
  });
}
