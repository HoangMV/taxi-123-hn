import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

export function getKyQuyIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_KyQuy') || '';
}

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
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

async function fetchRelatedMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchKyQuyRow(appSheetService, idKyQuy) {
  if (!idKyQuy) {
    throw new Error('Thiếu tham số ID_KyQuy trên URL.');
  }

  try {
    const bundle = await fetchKyQuyBundle(idKyQuy, { includeRelated: false });
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy hợp đồng ký quỹ với ID_KyQuy = ${idKyQuy}.`);
    }

    return row;
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const selectorValue = escapeSelectorValue(idKyQuy);
  const rows = await appSheetService.find('NHANSU_KYQUY', `Filter(NHANSU_KYQUY, [ID_KyQuy] = "${selectorValue}")`);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy hợp đồng ký quỹ với ID_KyQuy = ${idKyQuy}.`);
  }

  return row;
}

export function getKyQuyRelatedIds(row) {
  return {
    nhanSuIds: [row?.Ref_NhanSu],
    donViIds: [getDonViRefId(row)]
  };
}

export async function fetchKyQuyRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      nhanSuById: new Map(),
      donViById: new Map()
    };
  }

  const { nhanSuIds, donViIds } = getKyQuyRelatedIds(row);
  const [nhanSuById, donViById] = await Promise.all([
    fetchRelatedMap(appSheetService, 'NHANSU', 'ID_NhanSu', nhanSuIds),
    fetchRelatedMap(appSheetService, 'DONVI', 'ID_DonVi', donViIds)
  ]);

  return { nhanSuById, donViById };
}

export function buildKyQuyPayload(row, relatedData = {}) {
  const ngayKy = formatAdministrativeDate(row?.NgayKyHopDong);
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
    so_tien_da_nop: payload.soTienDaNopText,
    so_tien_con_lai: payload.soTienConLaiText,
    trang_thai_ky_quy: payload.trangThaiKyQuy
  };
}

export async function fetchKyQuyData(appSheetService, idKyQuy) {
  if (!idKyQuy) {
    throw new Error('Thiếu tham số ID_KyQuy trên URL.');
  }

  try {
    const bundle = await fetchKyQuyBundle(idKyQuy);
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy hợp đồng ký quỹ với ID_KyQuy = ${idKyQuy}.`);
    }
    let nhanSuById = buildMap(bundle.related?.NHANSU, 'ID_NhanSu');
    let donViById = buildMap(bundle.related?.DONVI, 'ID_DonVi');
    const { nhanSuIds, donViIds } = getKyQuyRelatedIds(row);

    if (appSheetService) {
      const missingNhanSuIds = nhanSuIds
        .map(cleanValue)
        .filter((id) => id && !nhanSuById.has(id));
      const missingDonViIds = donViIds
        .map(cleanValue)
        .filter((id) => id && !donViById.has(id));

      if (missingNhanSuIds.length > 0 || missingDonViIds.length > 0) {
        const [extraNhanSuById, extraDonViById] = await Promise.all([
          missingNhanSuIds.length > 0
            ? fetchRelatedMap(appSheetService, 'NHANSU', 'ID_NhanSu', missingNhanSuIds)
            : Promise.resolve(new Map()),
          missingDonViIds.length > 0
            ? fetchRelatedMap(appSheetService, 'DONVI', 'ID_DonVi', missingDonViIds)
            : Promise.resolve(new Map())
        ]);

        nhanSuById = mergeMaps(nhanSuById, extraNhanSuById);
        donViById = mergeMaps(donViById, extraDonViById);
      }
    }

    return buildKyQuyPayload(row, { nhanSuById, donViById });
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const row = await fetchKyQuyRow(appSheetService, idKyQuy);
  const related = await fetchKyQuyRelated(appSheetService, row);
  return buildKyQuyPayload(row, related);
}
