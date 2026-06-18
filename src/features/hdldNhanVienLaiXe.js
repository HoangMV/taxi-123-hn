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

async function fetchRelatedMap(legacyService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await legacyService.find(tableName, selector);
  return buildMap(rows, keyName);
}

export async function fetchHdldNhanVienLaiXeRow(idHopDongLaoDong) {
  if (!idHopDongLaoDong) {
    throw new Error('Thiếu tham số ID_HopDongLaoDong trên URL.');
  }

  const bundle = await fetchHdldBundle(idHopDongLaoDong, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_HopDongLaoDong = ${idHopDongLaoDong}.`);
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

export async function fetchHdldNhanVienLaiXeRelated(row) {
  const id = cleanValue(row?.ID_HopDongLaoDong);
  if (!id) return {
    nhanSuById: new Map(),
    donViById: new Map(),
    chucDanhById: new Map(),
    boPhanById: new Map(),
    mucLuongById: new Map()
  };
  const bundle = await fetchHdldBundle(id, { });
  const related = bundle.related || {};
  return {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh'),
    boPhanById: buildMap(related.DM_BOPHAN, 'ID_BoPhan'),
    mucLuongById: buildMap(related.DM_MUCLUONG_DONGBHXH, 'ID_MucLuong')
  };
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
      ? `Không tìm thấy mã lương ${mucLuongId} trong bảng DM_MUCLUONG_DONGBHXH. Phần mức lương sẽ để trống khi xuất Word.`
      : '',
    trangThaiXuLy: cleanValue(row?.TrangThaiXuLy),
    canhBaoHopDong: cleanValue(row?.CanhBaoHopDong),
    ghiChu: cleanValue(row?.GhiChu)
  };
}

export function buildHdldNhanVienLaiXeTemplateData(payload) {
  return {
    so_hop_dong: payload.soHopDong,
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

export async function fetchHdldNhanVienLaiXeData(idHopDongLaoDong) {
  if (!idHopDongLaoDong) {
    throw new Error('Thiếu tham số ID_HopDongLaoDong trên URL.');
  }

  const bundle = await fetchHdldBundle(idHopDongLaoDong);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_HopDongLaoDong = ${idHopDongLaoDong}.`);
  }
  const related = bundle.related || {};
  return buildHdldNhanVienLaiXePayload(row, {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh'),
    boPhanById: buildMap(related.DM_BOPHAN, 'ID_BoPhan'),
    mucLuongById: buildMap(related.DM_MUCLUONG_DONGBHXH, 'ID_MucLuong')
  });
}
