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

async function fetchRelatedMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchBanGiaoSoRow(appSheetService, idBanGiaoSo) {
  if (!idBanGiaoSo) {
    throw new Error('Thiếu tham số ID_BanGiaoSo trên URL.');
  }

  try {
    const bundle = await fetchBanGiaoSoBundle(idBanGiaoSo, { includeRelated: false });
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy biên bản bàn giao sổ BHXH với ID_BanGiaoSo = ${idBanGiaoSo}.`);
    }

    return row;
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const selectorValue = escapeSelectorValue(idBanGiaoSo);
  const rows = await appSheetService.find(TABLE_BAN_GIAO_SO, `Filter(${TABLE_BAN_GIAO_SO}, [ID_BanGiaoSo] = "${selectorValue}")`);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy biên bản bàn giao sổ BHXH với ID_BanGiaoSo = ${idBanGiaoSo}.`);
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

export async function fetchBanGiaoSoRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      bhxhById: new Map(),
      nhanSuById: new Map(),
      donViById: new Map(),
      chucDanhById: new Map()
    };
  }

  const bhxhById = await fetchRelatedMap(appSheetService, TABLE_BHXH, 'ID_BHXH', [row?.Ref_BHXH]);
  const bhxh = bhxhById.get(cleanValue(row?.Ref_BHXH));
  const nhanSuIds = [bhxh?.Ref_NhanSu, row?.NguoiGiao, row?.NguoiNhan];
  const [nhanSuById, donViRows] = await Promise.all([
    fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', nhanSuIds),
    appSheetService.find(TABLE_DON_VI)
  ]);
  const laoDong = nhanSuById.get(cleanValue(bhxh?.Ref_NhanSu));
  const chucDanhById = await fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', [laoDong?.Ref_ChucDanh]);
  const donViById = buildMap(donViRows, 'ID_DonVi');

  return { bhxhById, nhanSuById, donViById, chucDanhById };
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

export async function fetchBanGiaoSoData(appSheetService, idBanGiaoSo) {
  if (!idBanGiaoSo) {
    throw new Error('Thiếu tham số ID_BanGiaoSo trên URL.');
  }

  try {
    const bundle = await fetchBanGiaoSoBundle(idBanGiaoSo);
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy biên bản bàn giao sổ BHXH với ID_BanGiaoSo = ${idBanGiaoSo}.`);
    }

    let bhxhById = buildMap(bundle.related?.NHANSU_BHXH, 'ID_BHXH');
    let nhanSuById = buildMap(bundle.related?.NHANSU, 'ID_NhanSu');
    let donViById = buildMap(bundle.related?.DONVI, 'ID_DonVi');
    let chucDanhById = buildMap(bundle.related?.DM_CHUCDANH, 'ID_ChucDanh');

    if (appSheetService) {
      const bhxh = bhxhById.get(cleanValue(row.Ref_BHXH));
      const missingBhxhIds = [row.Ref_BHXH].map(cleanValue).filter((id) => id && !bhxhById.has(id));
      if (missingBhxhIds.length > 0) {
        bhxhById = mergeMaps(bhxhById, await fetchRelatedMap(appSheetService, TABLE_BHXH, 'ID_BHXH', missingBhxhIds));
      }

      const nextBhxh = bhxh || bhxhById.get(cleanValue(row.Ref_BHXH));
      const missingNhanSuIds = [nextBhxh?.Ref_NhanSu, row.NguoiGiao, row.NguoiNhan]
        .map(cleanValue)
        .filter((id) => id && !nhanSuById.has(id));
      const nextLaoDong = nhanSuById.get(cleanValue(nextBhxh?.Ref_NhanSu));
      const missingChucDanhIds = [nextLaoDong?.Ref_ChucDanh]
        .map(cleanValue)
        .filter((id) => id && !chucDanhById.has(id));

      if (missingNhanSuIds.length > 0 || missingChucDanhIds.length > 0 || donViById.size === 0) {
        const [extraNhanSuById, extraChucDanhById, extraDonViRows] = await Promise.all([
          missingNhanSuIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', missingNhanSuIds)
            : Promise.resolve(new Map()),
          missingChucDanhIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', missingChucDanhIds)
            : Promise.resolve(new Map()),
          donViById.size === 0 ? appSheetService.find(TABLE_DON_VI) : Promise.resolve([])
        ]);
        nhanSuById = mergeMaps(nhanSuById, extraNhanSuById);
        chucDanhById = mergeMaps(chucDanhById, extraChucDanhById);
        donViById = mergeMaps(donViById, buildMap(extraDonViRows, 'ID_DonVi'));
      }
    }

    return buildBanGiaoSoPayload(row, { bhxhById, nhanSuById, donViById, chucDanhById });
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const row = await fetchBanGiaoSoRow(appSheetService, idBanGiaoSo);
  const related = await fetchBanGiaoSoRelated(appSheetService, row);
  return buildBanGiaoSoPayload(row, related);
}
