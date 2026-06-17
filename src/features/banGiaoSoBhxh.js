import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

const TABLE_BAN_GIAO_SO = 'NHANSU_BHXH_BANGIAO_SO';
const TABLE_BHXH = 'NHANSU_BHXH';
const TABLE_NHAN_SU = 'NHANSU';
const TABLE_DON_VI = 'DONVI';
const TABLE_CHUC_DANH = 'DM_CHUCDANH';

export function getBanGiaoSoIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_BanGiaoSo') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = [...new Set(ids.map(cleanValue).filter(Boolean))];
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

function mergeMaps(primaryMap, secondaryMap) {
  const merged = new Map(primaryMap || []);
  for (const [key, value] of secondaryMap || []) {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  }
  return merged;
}

async function fetchBanGiaoSoBundle(idBanGiaoSo, options = {}) {
  const params = new URLSearchParams({
    ID_BanGiaoSo: idBanGiaoSo
  });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const response = await fetch(`/api/ban-giao-so-bhxh?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/ban-giao-so-bhxh chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu bàn giao sổ BHXH (${response.status}).`);
  }

  return data;
}

async function fetchRelatedMap(legacyService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await legacyService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchBanGiaoSoRow(idBanGiaoSo) {
  if (!idBanGiaoSo) {
    throw new Error('Thiếu tham số ID_BanGiaoSo trên URL.');
  }

  const bundle = await fetchBanGiaoSoBundle(idBanGiaoSo, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_BanGiaoSo = ${idBanGiaoSo}.`);
  }
  return row;
}

function getNhanSuDisplayName(nhanSu) {
  if (!nhanSu) return '';
  return cleanValue(nhanSu.HoTen) || cleanValue(nhanSu.Display) || cleanValue(nhanSu.ID_NhanSu);
}

function getNhanSuAddress(nhanSu) {
  return cleanValue(nhanSu?.Dia_Chi_Day_Du) || cleanValue(nhanSu?.Address);
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || cleanValue(donVi.ID_DonVi);
}

function normalizeLookupText(value) {
  return cleanValue(value).toLowerCase();
}

function findDonVi(donViById, value) {
  const ref = cleanValue(value);
  if (!ref) return null;
  const direct = donViById.get(ref);
  if (direct) return direct;

  const normalizedRef = normalizeLookupText(ref);
  for (const donVi of donViById.values()) {
    const candidates = [
      donVi?.ID_DonVi,
      donVi?.MaDonVi,
      donVi?.TenDonVi,
      donVi?.TenVietTat
    ].map(normalizeLookupText).filter(Boolean);
    if (
      candidates.some((candidate) => candidate === normalizedRef) ||
      candidates.some((candidate) => normalizedRef.includes(candidate) || candidate.includes(normalizedRef))
    ) {
      return donVi;
    }
  }

  return null;
}

function getChucDanhDisplayName(chucDanh) {
  if (!chucDanh) return '';
  return cleanValue(chucDanh.TenChucDanh) || cleanValue(chucDanh.Display) || cleanValue(chucDanh.ID_ChucDanh);
}

function getDonViIds(row, bhxh) {
  return [row?.DonViGiao, bhxh?.Ref_DonViDongBHXH, bhxh?.Ref_CoQuanBHXH];
}

export async function fetchBanGiaoSoRelated(row) {
  const id = cleanValue(row?.ID_BanGiaoSo);
  if (!id) return {
    bhxhById: new Map(),
    nhanSuById: new Map(),
    donViById: new Map(),
    chucDanhById: new Map()
  };
  const bundle = await fetchBanGiaoSoBundle(id, { });
  const related = bundle.related || {};
  return {
    bhxhById: buildMap(related.NHANSU_BHXH, 'ID_BHXH'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh')
  };
}

export function buildBanGiaoSoPayload(row, relatedData = {}) {
  const bhxhById = relatedData.bhxhById || new Map();
  const nhanSuById = relatedData.nhanSuById || new Map();
  const donViById = relatedData.donViById || new Map();
  const chucDanhById = relatedData.chucDanhById || new Map();
  const bhxhId = cleanValue(row?.Ref_BHXH);
  const bhxh = bhxhById.get(bhxhId);
  const nhanSuId = cleanValue(bhxh?.Ref_NhanSu);
  const nguoiGiaoId = cleanValue(row?.NguoiGiao);
  const nguoiNhanId = cleanValue(row?.NguoiNhan);
  const donViGiaoId = cleanValue(row?.DonViGiao);
  const donViGiao = findDonVi(donViById, donViGiaoId);
  const donViDongBhxh = findDonVi(donViById, bhxh?.Ref_DonViDongBHXH);
  const laoDong = nhanSuById.get(nhanSuId);
  const chucDanh = chucDanhById.get(cleanValue(laoDong?.Ref_ChucDanh));
  const nguoiGiao = nhanSuById.get(nguoiGiaoId);
  const nguoiNhan = nhanSuById.get(nguoiNhanId);
  const ngayGiaoNhan = formatAdministrativeDate(row?.NgayGiaoNhan);
  const soTrangSoToRoi = cleanValue(row?.SoTrangSoToRoi);
  const tenDonViGiao = getDonViDisplayName(donViGiao) || donViGiaoId || getDonViDisplayName(donViDongBhxh);
  const soSoBhxh = cleanValue(bhxh?.SoSoBHXH) || cleanValue(bhxh?.MaSoBHXH) || bhxhId;

  return {
    raw: row,
    rawBhxh: bhxh || null,
    idBanGiaoSo: cleanValue(row?.ID_BanGiaoSo),
    refBhxh: bhxhId,
    loaiGiaoDich: cleanValue(row?.LoaiGiaoDich),
    ngayGiaoNhan,
    ngayGiaoNhanText: formatAdministrativeDateString(row?.NgayGiaoNhan),
    tenDonViGiao,
    tenDonViGiaoUpper: tenDonViGiao.toUpperCase(),
    maSoThueDonVi: cleanValue(donViGiao?.MaSoThue) || cleanValue(donViGiao?.MaDonVi),
    diaChiDonVi: cleanValue(donViGiao?.DiaChi),
    hoTenNguoiGiao: getNhanSuDisplayName(nguoiGiao) || nguoiGiaoId,
    hoTenNguoiNhan: getNhanSuDisplayName(nguoiNhan) || nguoiNhanId,
    hoTenNguoiLaoDong: getNhanSuDisplayName(laoDong) || nhanSuId,
    chucVuNguoiLaoDong: getChucDanhDisplayName(chucDanh) || cleanValue(laoDong?.LoaiNhanSu),
    diaChiNguoiLaoDong: getNhanSuAddress(laoDong),
    soCccd: cleanValue(laoDong?.CCCD),
    ngayCapCccd: formatAdministrativeDateString(laoDong?.NgayCapCCCD),
    noiCapCccd: cleanValue(laoDong?.NoiCapCCCD),
    soSoBhxh,
    soBiaSo: cleanValue(row?.SoBiaSo),
    soTrangSoToRoi,
    soTrangSoToRoiText: numberToVietnameseWords(soTrangSoToRoi),
    hienTrangSo: cleanValue(row?.HienTrangSo),
    ghiChu: cleanValue(row?.GhiChu),
    trangThai: cleanValue(row?.TrangThai),
    tinhTrangSoBhxh: cleanValue(bhxh?.TinhTrangSoBHXH),
    trangThaiBhxh: cleanValue(bhxh?.TrangThaiBHXH)
  };
}

export function buildBanGiaoSoTemplateData(payload) {
  return {
    ngay_giao_nhan: payload.ngayGiaoNhan.day,
    thang_giao_nhan: payload.ngayGiaoNhan.month,
    nam_giao_nhan: payload.ngayGiaoNhan.year,
    ten_don_vi_giao: payload.tenDonViGiao,
    ten_don_vi_giao_upper: payload.tenDonViGiaoUpper,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    dia_chi_don_vi: payload.diaChiDonVi,
    ho_ten_nguoi_giao: payload.hoTenNguoiGiao,
    ho_ten_nguoi_nhan: payload.hoTenNguoiNhan,
    ho_ten_nguoi_lao_dong: payload.hoTenNguoiLaoDong,
    chuc_vu_nguoi_lao_dong: payload.chucVuNguoiLaoDong,
    dia_chi_nguoi_lao_dong: payload.diaChiNguoiLaoDong,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    so_so_bhxh: payload.soSoBhxh,
    so_bia_so: payload.soBiaSo,
    so_trang_so_to_roi: payload.soTrangSoToRoi,
    so_trang_so_to_roi_text: payload.soTrangSoToRoiText,
    hien_trang_so: payload.hienTrangSo,
    loai_giao_dich: payload.loaiGiaoDich,
    trang_thai: payload.trangThai,
    ghi_chu: payload.ghiChu
  };
}

export async function fetchBanGiaoSoData(idBanGiaoSo) {
  if (!idBanGiaoSo) {
    throw new Error('Thiếu tham số ID_BanGiaoSo trên URL.');
  }

  const bundle = await fetchBanGiaoSoBundle(idBanGiaoSo);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_BanGiaoSo = ${idBanGiaoSo}.`);
  }
  const related = bundle.related || {};
  return buildBanGiaoSoPayload(row, {
    bhxhById: buildMap(related.NHANSU_BHXH, 'ID_BHXH'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh')
  });
}
