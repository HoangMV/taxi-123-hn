import { formatAdministrativeDate, formatAdministrativeDateString, parseDateValue } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

const TABLE_THANH_LY_KY_QUY = 'NHANSU_KYQUY_THANHLY';
const TABLE_KY_QUY = 'NHANSU_KYQUY';
const TABLE_NHAN_SU = 'NHANSU';
const TABLE_DON_VI = 'DONVI';
const TABLE_THANH_LY_HOP_DONG = 'NHANSU_THANHLY_HOPDONG';
const TABLE_HOP_DONG_LAO_DONG = 'NHANSU_HOPDONG_LAODONG';

export function getThanhLyKyQuyIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ThanhLy') || '';
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

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
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

async function fetchRelatedMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchThanhLyKyQuyRow(appSheetService, idThanhLy) {
  if (!idThanhLy) {
    throw new Error('Thiếu tham số ID_ThanhLy trên URL.');
  }

  try {
    const bundle = await fetchThanhLyKyQuyBundle(idThanhLy, { includeRelated: false });
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy biên bản thanh lý ký quỹ với ID_ThanhLy = ${idThanhLy}.`);
    }

    return row;
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const selector = buildEqualsSelector(TABLE_THANH_LY_KY_QUY, 'ID_ThanhLy', idThanhLy);
  const rows = await appSheetService.find(TABLE_THANH_LY_KY_QUY, selector);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy biên bản thanh lý ký quỹ với ID_ThanhLy = ${idThanhLy}.`);
  }

  return row;
}

export async function fetchThanhLyKyQuyRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      kyQuyById: new Map(),
      nhanSuById: new Map(),
      donViById: new Map(),
      thanhLyHopDongRows: [],
      hopDongLaoDongById: new Map()
    };
  }

  const kyQuyById = await fetchRelatedMap(appSheetService, TABLE_KY_QUY, 'ID_KyQuy', [row?.Ref_KyQuy]);
  const kyQuy = kyQuyById.get(cleanValue(row?.Ref_KyQuy));
  const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
  const donViId = getDonViRefId(kyQuy);

  const [nhanSuById, donViById, thanhLyHopDongRows] = await Promise.all([
    fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', [nhanSuId]),
    fetchRelatedMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', [donViId]),
    nhanSuId ? appSheetService.find(TABLE_THANH_LY_HOP_DONG, buildEqualsSelector(TABLE_THANH_LY_HOP_DONG, 'Ref_NhanSu', nhanSuId)) : Promise.resolve([])
  ]);

  const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row?.NgayLap);
  const hopDongLaoDongById = await fetchRelatedMap(appSheetService, TABLE_HOP_DONG_LAO_DONG, 'ID_HopDongLaoDong', [thanhLyHopDong?.Ref_HopDongLD]);

  return {
    kyQuyById,
    nhanSuById,
    donViById,
    thanhLyHopDongRows,
    hopDongLaoDongById
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

export async function fetchThanhLyKyQuyData(appSheetService, idThanhLy) {
  if (!idThanhLy) {
    throw new Error('Thiếu tham số ID_ThanhLy trên URL.');
  }

  try {
    const bundle = await fetchThanhLyKyQuyBundle(idThanhLy);
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy biên bản thanh lý ký quỹ với ID_ThanhLy = ${idThanhLy}.`);
    }

    let kyQuyById = buildMap(bundle.related?.NHANSU_KYQUY, 'ID_KyQuy');
    let nhanSuById = buildMap(bundle.related?.NHANSU, 'ID_NhanSu');
    let donViById = buildMap(bundle.related?.DONVI, 'ID_DonVi');
    let thanhLyHopDongRows = bundle.related?.NHANSU_THANHLY_HOPDONG || [];
    let hopDongLaoDongById = buildMap(bundle.related?.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong');

    if (appSheetService) {
      const kyQuyId = cleanValue(row.Ref_KyQuy);
      if (kyQuyId && !kyQuyById.has(kyQuyId)) {
        kyQuyById = mergeMaps(kyQuyById, await fetchRelatedMap(appSheetService, TABLE_KY_QUY, 'ID_KyQuy', [kyQuyId]));
      }

      const kyQuy = kyQuyById.get(kyQuyId);
      const nhanSuId = cleanValue(kyQuy?.Ref_NhanSu);
      const donViId = getDonViRefId(kyQuy);
      const missingNhanSuIds = [nhanSuId].filter((id) => id && !nhanSuById.has(id));
      const missingDonViIds = [donViId].filter((id) => id && !donViById.has(id));

      if (missingNhanSuIds.length > 0 || missingDonViIds.length > 0 || (nhanSuId && thanhLyHopDongRows.length === 0)) {
        const [extraNhanSuById, extraDonViById, extraThanhLyHopDongRows] = await Promise.all([
          missingNhanSuIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', missingNhanSuIds)
            : Promise.resolve(new Map()),
          missingDonViIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', missingDonViIds)
            : Promise.resolve(new Map()),
          nhanSuId && thanhLyHopDongRows.length === 0
            ? appSheetService.find(TABLE_THANH_LY_HOP_DONG, buildEqualsSelector(TABLE_THANH_LY_HOP_DONG, 'Ref_NhanSu', nhanSuId))
            : Promise.resolve([])
        ]);
        nhanSuById = mergeMaps(nhanSuById, extraNhanSuById);
        donViById = mergeMaps(donViById, extraDonViById);
        if (extraThanhLyHopDongRows.length > 0) {
          thanhLyHopDongRows = extraThanhLyHopDongRows;
        }
      }

      const thanhLyHopDong = pickThanhLyHopDong(thanhLyHopDongRows, row.NgayLap);
      const hopDongLaoDongId = cleanValue(thanhLyHopDong?.Ref_HopDongLD);
      if (hopDongLaoDongId && !hopDongLaoDongById.has(hopDongLaoDongId)) {
        hopDongLaoDongById = mergeMaps(
          hopDongLaoDongById,
          await fetchRelatedMap(appSheetService, TABLE_HOP_DONG_LAO_DONG, 'ID_HopDongLaoDong', [hopDongLaoDongId])
        );
      }
    }

    return buildThanhLyKyQuyPayload(row, {
      kyQuyById,
      nhanSuById,
      donViById,
      thanhLyHopDongRows,
      hopDongLaoDongById
    });
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const row = await fetchThanhLyKyQuyRow(appSheetService, idThanhLy);
  const related = await fetchThanhLyKyQuyRelated(appSheetService, row);
  return buildThanhLyKyQuyPayload(row, related);
}
