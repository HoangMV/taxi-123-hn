import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

const TABLE_HOP_DONG = 'NHANSU_HOPDONG_LAODONG';
const TABLE_NHAN_SU = 'NHANSU';
const TABLE_DON_VI = 'DONVI';
const TABLE_CHUC_DANH = 'DM_CHUCDANH';
const TABLE_BO_PHAN = 'DM_BOPHAN';
const TABLE_MUC_LUONG = 'DM_MUCLUONG_DONGBHXH';

export function getHdldNhanVienLaiXeIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HopDongLaoDong') || '';
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

async function fetchHdldBundle(idHopDongLaoDong, options = {}) {
  const params = new URLSearchParams({
    ID_HopDongLaoDong: idHopDongLaoDong
  });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const response = await fetch(`/api/hdld-nhan-vien-lai-xe?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/hdld-nhan-vien-lai-xe chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu HĐLĐ nhân viên lái xe (${response.status}).`);
  }

  return data;
}

async function fetchRelatedMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchHdldNhanVienLaiXeRow(appSheetService, idHopDongLaoDong) {
  if (!idHopDongLaoDong) {
    throw new Error('Thiếu tham số ID_HopDongLaoDong trên URL.');
  }

  try {
    const bundle = await fetchHdldBundle(idHopDongLaoDong, { includeRelated: false });
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy HĐLĐ nhân viên lái xe với ID_HopDongLaoDong = ${idHopDongLaoDong}.`);
    }

    return row;
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const selectorValue = escapeSelectorValue(idHopDongLaoDong);
  const rows = await appSheetService.find(
    TABLE_HOP_DONG,
    `Filter(${TABLE_HOP_DONG}, [ID_HopDongLaoDong] = "${selectorValue}")`
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy HĐLĐ nhân viên lái xe với ID_HopDongLaoDong = ${idHopDongLaoDong}.`);
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

function getChucDanhDisplayName(chucDanh) {
  if (!chucDanh) return '';
  return cleanValue(chucDanh.TenChucDanh) || cleanValue(chucDanh.Display) || cleanValue(chucDanh.ID_ChucDanh);
}

function getBoPhanDisplayName(boPhan) {
  if (!boPhan) return '';
  return cleanValue(boPhan.TenBoPhan) || cleanValue(boPhan.Display) || cleanValue(boPhan.ID_BoPhan);
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

function formatMoney(value) {
  const digits = cleanValue(value).replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function getSalaryDigits(value) {
  return cleanValue(value).replace(/[^\d]/g, '');
}

export async function fetchHdldNhanVienLaiXeRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      nhanSuById: new Map(),
      donViById: new Map(),
      chucDanhById: new Map(),
      boPhanById: new Map(),
      mucLuongById: new Map()
    };
  }

  const [nhanSuById, donViRows, mucLuongById] = await Promise.all([
    fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', [row?.Ref_NhanSu, row?.Ref_NguoiKy]),
    appSheetService.find(TABLE_DON_VI),
    fetchRelatedMap(appSheetService, TABLE_MUC_LUONG, 'ID_MucLuong', [row?.MucLuongCoBan])
  ]);
  const nhanSu = nhanSuById.get(cleanValue(row?.Ref_NhanSu));
  const nguoiKy = nhanSuById.get(cleanValue(row?.Ref_NguoiKy));
  const chucDanhById = await fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', [
    nhanSu?.Ref_ChucDanh,
    nguoiKy?.Ref_ChucDanh,
    row?.Ref_BoPhan
  ]);
  const chucDanh = chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) || chucDanhById.get(cleanValue(row?.Ref_BoPhan));
  const nguoiKyChucDanh = chucDanhById.get(cleanValue(nguoiKy?.Ref_ChucDanh));
  const boPhanById = await fetchRelatedMap(appSheetService, TABLE_BO_PHAN, 'ID_BoPhan', [
    row?.Ref_BoPhan,
    chucDanh?.Ref_BoPhan,
    nguoiKyChucDanh?.Ref_BoPhan
  ]);
  const donViById = buildMap(donViRows, 'ID_DonVi');

  return { nhanSuById, donViById, chucDanhById, boPhanById, mucLuongById };
}

export function buildHdldNhanVienLaiXePayload(row, relatedData = {}) {
  const nhanSuById = relatedData.nhanSuById || new Map();
  const donViById = relatedData.donViById || new Map();
  const chucDanhById = relatedData.chucDanhById || new Map();
  const boPhanById = relatedData.boPhanById || new Map();
  const mucLuongById = relatedData.mucLuongById || new Map();
  const nhanSuId = cleanValue(row?.Ref_NhanSu);
  const nguoiKyId = cleanValue(row?.Ref_NguoiKy);
  const donViId = cleanValue(row?.Ref_DonViLamViec);
  const mucLuongId = cleanValue(row?.MucLuongCoBan);
  const nhanSu = nhanSuById.get(nhanSuId);
  const nguoiKy = nhanSuById.get(nguoiKyId);
  const donVi = findDonVi(donViById, donViId);
  const chucDanh = chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) || chucDanhById.get(cleanValue(row?.Ref_BoPhan));
  const nguoiKyChucDanh = chucDanhById.get(cleanValue(nguoiKy?.Ref_ChucDanh));
  const boPhan = boPhanById.get(cleanValue(row?.Ref_BoPhan)) || boPhanById.get(cleanValue(chucDanh?.Ref_BoPhan));
  const mucLuong = mucLuongById.get(mucLuongId);
  const salaryDigits = getSalaryDigits(mucLuong?.MucLuong);
  const salaryWords = salaryDigits ? `${numberToVietnameseWords(salaryDigits)} đồng` : '';
  const ngayKy = formatAdministrativeDate(row?.NgayKy);
  const tenDonVi = getDonViDisplayName(donVi) || donViId;
  const hoTenNguoiKy = getNhanSuDisplayName(nguoiKy) || cleanValue(donVi?.NguoiDaiDien);
  const chucVuNguoiKy = getChucDanhDisplayName(nguoiKyChucDanh) || cleanValue(donVi?.ChucVuNguoiDaiDien);
  const missingSalary = Boolean(mucLuongId && !mucLuong);
  const soHopDong = cleanValue(row?.SoHopDong) || cleanValue(nhanSu?.CCCD) || cleanValue(row?.ID_HopDongLaoDong);

  return {
    raw: row,
    rawNhanSu: nhanSu || null,
    rawDonVi: donVi || null,
    idHopDongLaoDong: cleanValue(row?.ID_HopDongLaoDong),
    refNhanSu: nhanSuId,
    refDonViLamViec: donViId,
    refNguoiKy: nguoiKyId,
    refBoPhan: cleanValue(row?.Ref_BoPhan),
    refMucLuong: mucLuongId,
    soHopDong,
    namHopDong: ngayKy.year,
    loaiHopDong: cleanValue(row?.LoaiHopDong),
    ngayKy,
    ngayKyText: formatAdministrativeDateString(row?.NgayKy),
    ngayBatDauText: formatAdministrativeDateString(row?.NgayBatDau),
    ngayKetThucText: formatAdministrativeDateString(row?.NgayKetThuc),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue) || cleanValue(donVi?.MaDonVi),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    hoTenNguoiKy,
    chucVuNguoiKy,
    hoTenNhanSu: getNhanSuDisplayName(nhanSu) || nhanSuId,
    ngaySinh: formatAdministrativeDateString(nhanSu?.NgaySinh),
    diaChiNhanSu: getNhanSuAddress(nhanSu),
    soCccd: cleanValue(nhanSu?.CCCD),
    ngayCapCccd: formatAdministrativeDateString(nhanSu?.NgayCapCCCD),
    noiCapCccd: cleanValue(nhanSu?.NoiCapCCCD),
    soGplx: cleanValue(nhanSu?.SoGPLX),
    hanGplx: formatAdministrativeDateString(nhanSu?.HanGPLX),
    hangGplx: cleanValue(nhanSu?.HangGPLX) || 'B2',
    chucDanh: getChucDanhDisplayName(chucDanh) || cleanValue(row?.Ref_BoPhan),
    boPhan: getBoPhanDisplayName(boPhan),
    mucLuongRaw: cleanValue(mucLuong?.MucLuong),
    mucLuongText: formatMoney(mucLuong?.MucLuong),
    mucLuongBangChu: salaryWords,
    missingSalary,
    missingSalaryMessage: missingSalary
      ? `Không tìm thấy mã lương ${mucLuongId} trong bảng DM_MUCLUONG_DONGBHXH. Hệ thống đã khóa xuất Word để tránh phát hành hợp đồng sai.`
      : '',
    trangThaiXuLy: cleanValue(row?.TrangThaiXuLy),
    canhBaoHopDong: cleanValue(row?.CanhBaoHopDong),
    ghiChu: cleanValue(row?.GhiChu)
  };
}

export function buildHdldNhanVienLaiXeTemplateData(payload) {
  return {
    so_hop_dong: payload.soHopDong,
    nam_hop_dong: payload.namHopDong,
    ngay_ky_text: payload.ngayKyText,
    ngay_ky: payload.ngayKy.day,
    thang_ky: payload.ngayKy.month,
    nam_ky: payload.ngayKy.year,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    dia_chi_don_vi: payload.diaChiDonVi,
    ho_ten_nguoi_ky: payload.hoTenNguoiKy,
    chuc_vu_nguoi_ky: payload.chucVuNguoiKy,
    ho_ten_nhan_su: payload.hoTenNhanSu,
    ngay_sinh: payload.ngaySinh,
    dia_chi_nhan_su: payload.diaChiNhanSu,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    so_gplx: payload.soGplx,
    hang_gplx: payload.hangGplx,
    chuc_danh: payload.chucDanh,
    bo_phan: payload.boPhan,
    loai_hop_dong: payload.loaiHopDong,
    ngay_bat_dau: payload.ngayBatDauText,
    ngay_ket_thuc: payload.ngayKetThucText,
    muc_luong: payload.mucLuongText,
    muc_luong_bang_chu: payload.mucLuongBangChu,
    trang_thai: payload.trangThaiXuLy,
    ghi_chu: payload.ghiChu
  };
}

export async function fetchHdldNhanVienLaiXeData(appSheetService, idHopDongLaoDong) {
  if (!idHopDongLaoDong) {
    throw new Error('Thiếu tham số ID_HopDongLaoDong trên URL.');
  }

  try {
    const bundle = await fetchHdldBundle(idHopDongLaoDong);
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy HĐLĐ nhân viên lái xe với ID_HopDongLaoDong = ${idHopDongLaoDong}.`);
    }

    let nhanSuById = buildMap(bundle.related?.NHANSU, 'ID_NhanSu');
    let donViById = buildMap(bundle.related?.DONVI, 'ID_DonVi');
    let chucDanhById = buildMap(bundle.related?.DM_CHUCDANH, 'ID_ChucDanh');
    let boPhanById = buildMap(bundle.related?.DM_BOPHAN, 'ID_BoPhan');
    let mucLuongById = buildMap(bundle.related?.DM_MUCLUONG_DONGBHXH, 'ID_MucLuong');

    if (appSheetService) {
      const nhanSu = nhanSuById.get(cleanValue(row.Ref_NhanSu));
      const nguoiKy = nhanSuById.get(cleanValue(row.Ref_NguoiKy));
      const missingNhanSuIds = [row.Ref_NhanSu, row.Ref_NguoiKy].map(cleanValue).filter((id) => id && !nhanSuById.has(id));
      const missingChucDanhIds = [nhanSu?.Ref_ChucDanh, nguoiKy?.Ref_ChucDanh, row.Ref_BoPhan]
        .map(cleanValue)
        .filter((id) => id && !chucDanhById.has(id));
      const chucDanh = chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) || chucDanhById.get(cleanValue(row.Ref_BoPhan));
      const missingBoPhanIds = [row.Ref_BoPhan, chucDanh?.Ref_BoPhan]
        .map(cleanValue)
        .filter((id) => id && !boPhanById.has(id));
      const missingMucLuongIds = [row.MucLuongCoBan].map(cleanValue).filter((id) => id && !mucLuongById.has(id));

      if (
        missingNhanSuIds.length > 0 ||
        missingChucDanhIds.length > 0 ||
        missingBoPhanIds.length > 0 ||
        missingMucLuongIds.length > 0 ||
        donViById.size === 0
      ) {
        const [extraNhanSuById, extraChucDanhById, extraBoPhanById, extraMucLuongById, extraDonViRows] = await Promise.all([
          missingNhanSuIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', missingNhanSuIds)
            : Promise.resolve(new Map()),
          missingChucDanhIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', missingChucDanhIds)
            : Promise.resolve(new Map()),
          missingBoPhanIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_BO_PHAN, 'ID_BoPhan', missingBoPhanIds)
            : Promise.resolve(new Map()),
          missingMucLuongIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_MUC_LUONG, 'ID_MucLuong', missingMucLuongIds)
            : Promise.resolve(new Map()),
          donViById.size === 0 ? appSheetService.find(TABLE_DON_VI) : Promise.resolve([])
        ]);
        nhanSuById = mergeMaps(nhanSuById, extraNhanSuById);
        chucDanhById = mergeMaps(chucDanhById, extraChucDanhById);
        boPhanById = mergeMaps(boPhanById, extraBoPhanById);
        mucLuongById = mergeMaps(mucLuongById, extraMucLuongById);
        donViById = mergeMaps(donViById, buildMap(extraDonViRows, 'ID_DonVi'));
      }
    }

    return buildHdldNhanVienLaiXePayload(row, { nhanSuById, donViById, chucDanhById, boPhanById, mucLuongById });
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const row = await fetchHdldNhanVienLaiXeRow(appSheetService, idHopDongLaoDong);
  const related = await fetchHdldNhanVienLaiXeRelated(appSheetService, row);
  return buildHdldNhanVienLaiXePayload(row, related);
}
