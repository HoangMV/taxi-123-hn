import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export function getThanhLyHopDongIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ThanhLyHD') || '';
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

async function fetchThanhLyHopDongBundle(idThanhLyHD, options = {}) {
  const params = new URLSearchParams({ ID_ThanhLyHD: idThanhLyHD });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const sourceRow = options.sourceRow || null;
  const hasSourceRow = sourceRow && cleanValue(sourceRow.ID_ThanhLyHD) === cleanValue(idThanhLyHD);
  const response = await fetch(`/api/thanh-ly-hop-dong-lao-dong?${params.toString()}`, {
    method: hasSourceRow ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(hasSourceRow ? { 'Content-Type': 'application/json' } : {})
    },
    body: hasSourceRow ? JSON.stringify({ ID_ThanhLyHD: idThanhLyHD, row: sourceRow }) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/thanh-ly-hop-dong-lao-dong chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu thanh lý HĐLĐ (${response.status}).`);
  }

  return data;
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

function getDonViId(hopDongLaoDong, nhanSu) {
  return (
    cleanValue(hopDongLaoDong?.Ref_DonViLamViec) ||
    cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
    cleanValue(nhanSu?.Ref_DonViChuQuan)
  );
}

function isHopDongMatchedNhanSu(hopDongLaoDong, nhanSuId) {
  const hopDongNhanSuId = cleanValue(hopDongLaoDong?.Ref_NhanSu);
  return Boolean(hopDongLaoDong) && Boolean(nhanSuId) && hopDongNhanSuId === nhanSuId;
}

function buildHopDongNumber(hopDongLaoDong, nhanSuId) {
  const matchedNhanSu = isHopDongMatchedNhanSu(hopDongLaoDong, nhanSuId);
  const soHopDong = matchedNhanSu ? cleanValue(hopDongLaoDong?.SoHopDong) : '';

  return { soHopDong, matchedNhanSu };
}

export async function fetchThanhLyHopDongRow(idThanhLyHD) {
  if (!idThanhLyHD) {
    throw new Error('Thiếu tham số ID_ThanhLyHD trên URL.');
  }

  const bundle = await fetchThanhLyHopDongBundle(idThanhLyHD, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ThanhLyHD = ${idThanhLyHD}.`);
  }
  return row;
}

export async function fetchThanhLyHopDongRelated(row) {
  const id = cleanValue(row?.ID_ThanhLyHD);
  if (!id) return {
    nhanSuById: new Map(),
    hopDongLaoDongById: new Map(),
    chamDutHopDongById: new Map(),
    donViById: new Map()
  };
  const bundle = await fetchThanhLyHopDongBundle(id, { sourceRow: row });
  const related = bundle.related || {};
  return {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong'),
    chamDutHopDongById: buildMap(related.NHANSU_CHAMDUT_HOPDONG, 'ID_ChamDutHD'),
    donViById: buildMap(related.DONVI, 'ID_DonVi')
  };
}

export function buildThanhLyHopDongPayload(row, relatedData = {}) {
  const nhanSuById = relatedData.nhanSuById || new Map();
  const hopDongLaoDongById = relatedData.hopDongLaoDongById || new Map();
  const chamDutHopDongById = relatedData.chamDutHopDongById || new Map();
  const donViById = relatedData.donViById || new Map();
  const idThanhLyHD = cleanValue(row?.ID_ThanhLyHD);
  const nhanSuId = cleanValue(row?.Ref_NhanSu);
  const hopDongLaoDongId = cleanValue(row?.Ref_HopDongLD);
  const chamDutHopDongId = cleanValue(row?.Ref_ChamDutHD);
  const nhanSu = nhanSuById.get(nhanSuId);
  const hopDongLaoDong = hopDongLaoDongById.get(hopDongLaoDongId);
  const chamDutHopDong = chamDutHopDongById.get(chamDutHopDongId);
  const donViId = getDonViId(hopDongLaoDong, nhanSu);
  const donVi = donViById.get(donViId);
  const tenDonVi = getDonViDisplayName(donVi);
  const ngayLap = formatAdministrativeDate(row?.NgayThanhLy);
  const hopDongNumber = buildHopDongNumber(hopDongLaoDong, nhanSuId);
  const matchedHopDongLaoDong = hopDongNumber.matchedNhanSu;
  const ngayChamDut = cleanValue(row?.NgayChamDut) || cleanValue(chamDutHopDong?.NgayChamDut);

  const payload = {
    raw: row,
    rawNhanSu: nhanSu || null,
    rawHopDongLaoDong: hopDongLaoDong || null,
    rawChamDutHopDong: chamDutHopDong || null,
    rawDonVi: donVi || null,
    idThanhLyHD,
    refNhanSu: nhanSuId,
    refHopDongLaoDong: hopDongLaoDongId,
    refChamDutHopDong: chamDutHopDongId,
    matchedHopDongLaoDong,
    soBienBan: cleanValue(row?.SoBienBan) || idThanhLyHD,
    ngayLap,
    ngayLapText: formatAdministrativeDateString(row?.NgayThanhLy),
    ngayThanhLyText: formatAdministrativeDateString(row?.NgayThanhLy),
    ngayChamDutText: formatAdministrativeDateString(ngayChamDut),
    lyDoThanhLy: cleanValue(row?.LyDoThanhLy) || cleanValue(chamDutHopDong?.LyDoChamDut),
    daBanGiaoTaiSan: cleanValue(row?.DaBanGiaoTaiSan),
    daThanhToanCongNo: cleanValue(row?.DaThanhToanCongNo),
    daHoanTatKyQuy: cleanValue(row?.DaHoanTatKyQuy),
    daKetThucPhanCongXe: cleanValue(row?.DaKetThucPhanCongXe),
    trangThaiThanhLy: cleanValue(row?.TrangThaiThanhLy),
    fileBienBan: cleanValue(row?.FileBienBan),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue) || cleanValue(donVi?.MaDonVi),
    daiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    chucVuDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    hoTenNhanSu: getNhanSuDisplayName(nhanSu),
    diaChiNhanSu: getNhanSuAddress(nhanSu),
    soCccd: cleanValue(nhanSu?.CCCD),
    ngayCapCccd: formatAdministrativeDateString(nhanSu?.NgayCapCCCD),
    noiCapCccd: cleanValue(nhanSu?.NoiCapCCCD),
    soHopDongLaoDong: hopDongNumber.soHopDong,
    ngayKyHopDongLaoDong: matchedHopDongLaoDong ? formatAdministrativeDateString(hopDongLaoDong?.NgayKy) : '',
    ghiChu: cleanValue(row?.GhiChu)
  };

  return {
    ...payload,
    missingRequiredFields: getThanhLyHopDongMissingRequiredFields(payload)
  };
}

export function getThanhLyHopDongMissingRequiredFields(payload) {
  if (!payload) return ['Dữ liệu biên bản'];

  const requiredFields = [
    ['Số biên bản', payload.soBienBan],
    ['Ngày lập biên bản', payload.ngayLap?.day && payload.ngayLap?.month && payload.ngayLap?.year],
    ['Tên đơn vị', payload.tenDonVi],
    ['Địa chỉ đơn vị', payload.diaChiDonVi],
    ['Mã số thuế đơn vị', payload.maSoThueDonVi],
    ['Đại diện đơn vị', payload.daiDienDonVi],
    ['Chức vụ đại diện', payload.chucVuDaiDien],
    ['Họ tên người lao động', payload.hoTenNhanSu],
    ['Địa chỉ người lao động', payload.diaChiNhanSu],
    ['Số CCCD', payload.soCccd],
    ['Ngày cấp CCCD', payload.ngayCapCccd],
    ['Nơi cấp CCCD', payload.noiCapCccd],
    ['Hợp đồng lao động khớp nhân sự', payload.matchedHopDongLaoDong ? 'Y' : ''],
    ['Ngày ký hợp đồng lao động', payload.ngayKyHopDongLaoDong],
    ['Ngày chấm dứt HĐLĐ', payload.ngayChamDutText],
    ['Lý do thanh lý', payload.lyDoThanhLy]
  ];

  return requiredFields.filter(([, value]) => !cleanValue(value)).map(([label]) => label);
}

export function shouldFetchThanhLyHopDongRelated(payload) {
  return getThanhLyHopDongMissingRequiredFields(payload).length > 0;
}

export function buildThanhLyHopDongTemplateData(payload) {
  return {
    so_bien_ban: payload.soBienBan,
    ngay_lap: payload.ngayLap.day,
    thang_lap: payload.ngayLap.month,
    nam_lap: payload.ngayLap.year,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    dai_dien_don_vi: payload.daiDienDonVi,
    chuc_vu_dai_dien: payload.chucVuDaiDien,
    ho_ten_nhan_su: payload.hoTenNhanSu,
    dia_chi_nhan_su: payload.diaChiNhanSu,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    so_hop_dong_lao_dong: payload.soHopDongLaoDong,
    ngay_ky_hop_dong_lao_dong: payload.ngayKyHopDongLaoDong,
    ngay_cham_dut: payload.ngayChamDutText,
    ly_do_thanh_ly: payload.lyDoThanhLy,
    trang_thai_thanh_ly: payload.trangThaiThanhLy
  };
}

export async function fetchThanhLyHopDongData(idThanhLyHD) {
  if (!idThanhLyHD) {
    throw new Error('Thiếu tham số ID_ThanhLyHD trên URL.');
  }

  const bundle = await fetchThanhLyHopDongBundle(idThanhLyHD);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ThanhLyHD = ${idThanhLyHD}.`);
  }
  const related = bundle.related || {};
  return buildThanhLyHopDongPayload(row, {
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong'),
    chamDutHopDongById: buildMap(related.NHANSU_CHAMDUT_HOPDONG, 'ID_ChamDutHD'),
    donViById: buildMap(related.DONVI, 'ID_DonVi')
  });
}
