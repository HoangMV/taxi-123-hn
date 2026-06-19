import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export function getChamDutHopDongIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ChamDutHD') || '';
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

async function fetchChamDutBundle(idChamDutHD, options = {}) {
  const params = new URLSearchParams({ ID_ChamDutHD: idChamDutHD });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }
  const sourceRow = options.sourceRow || null;
  const hasSourceRow = sourceRow && cleanValue(sourceRow.ID_ChamDutHD) === cleanValue(idChamDutHD);

  const response = await fetch(`/api/cham-dut-hop-dong-lao-dong?${params.toString()}`, {
    method: hasSourceRow ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(hasSourceRow ? { 'Content-Type': 'application/json' } : {})
    },
    body: hasSourceRow ? JSON.stringify({ ID_ChamDutHD: idChamDutHD, row: sourceRow }) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Route /api/cham-dut-hop-dong-lao-dong chưa trả JSON hợp lệ trong môi trường hiện tại.');
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu chấm dứt HĐLĐ (${response.status}).`);
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

function getChucDanhDisplayName(chucDanh) {
  if (!chucDanh) return '';
  return cleanValue(chucDanh.TenChucDanh) || cleanValue(chucDanh.Display) || cleanValue(chucDanh.ID_ChucDanh);
}

function getBoPhanDisplayName(boPhan) {
  if (!boPhan) return '';
  return cleanValue(boPhan.TenBoPhan) || cleanValue(boPhan.Display) || cleanValue(boPhan.ID_BoPhan);
}

function getDonViId(hopDongLaoDong, nhanSu) {
  return (
    cleanValue(hopDongLaoDong?.Ref_DonViLamViec) ||
    cleanValue(nhanSu?.Ref_DonViLamViecHienTai) ||
    cleanValue(nhanSu?.Ref_DonViChuQuan)
  );
}

export async function fetchChamDutHopDongRow(idChamDutHD) {
  if (!idChamDutHD) {
    throw new Error('Thiếu tham số ID_ChamDutHD trên URL.');
  }

  const bundle = await fetchChamDutBundle(idChamDutHD, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ChamDutHD = ${idChamDutHD}.`);
  }
  return row;
}

export async function fetchChamDutHopDongRelated(row) {
  const id = cleanValue(row?.ID_ChamDutHD);
  if (!id) return {
    hopDongLaoDongById: new Map(),
    nhanSuById: new Map(),
    donViById: new Map(),
    chucDanhById: new Map(),
    boPhanById: new Map()
  };
  const bundle = await fetchChamDutBundle(id, { sourceRow: row });
  const related = bundle.related || {};
  return {
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh'),
    boPhanById: buildMap(related.DM_BOPHAN, 'ID_BoPhan')
  };
}

export function buildChamDutHopDongPayload(row, relatedData = {}) {
  const hopDongLaoDongById = relatedData.hopDongLaoDongById || new Map();
  const nhanSuById = relatedData.nhanSuById || new Map();
  const donViById = relatedData.donViById || new Map();
  const chucDanhById = relatedData.chucDanhById || new Map();
  const boPhanById = relatedData.boPhanById || new Map();
  const idChamDutHD = cleanValue(row?.ID_ChamDutHD);
  const nhanSuId = cleanValue(row?.Ref_NhanSu);
  const nguoiKyId = cleanValue(row?.Ref_NguoiKy);
  const hopDongLaoDongId = cleanValue(row?.Ref_HopDongLD);
  const nhanSu = nhanSuById.get(nhanSuId);
  const nguoiKy = nhanSuById.get(nguoiKyId);
  const hopDongLaoDong = hopDongLaoDongById.get(hopDongLaoDongId);
  const donViId = getDonViId(hopDongLaoDong, nhanSu);
  const donVi = donViById.get(donViId);
  const chucDanh =
    chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) ||
    chucDanhById.get(cleanValue(hopDongLaoDong?.Ref_BoPhan)) ||
    chucDanhById.get(cleanValue(nhanSu?.Ref_BoPhan));
  const boPhan =
    boPhanById.get(cleanValue(nhanSu?.Ref_BoPhan)) ||
    boPhanById.get(cleanValue(hopDongLaoDong?.Ref_BoPhan)) ||
    boPhanById.get(cleanValue(chucDanh?.Ref_BoPhan));
  const nguoiKyChucDanh = chucDanhById.get(cleanValue(nguoiKy?.Ref_ChucDanh));
  const ngayQuyetDinh = formatAdministrativeDate(row?.NgayQuyetDinh);
  const tenDonVi = getDonViDisplayName(donVi) || donViId;
  const hoTenNguoiKy = getNhanSuDisplayName(nguoiKy) || cleanValue(donVi?.NguoiDaiDien);
  const chucVuNguoiKy = getChucDanhDisplayName(nguoiKyChucDanh) || cleanValue(donVi?.ChucVuNguoiDaiDien);
  const chucDanhText =
    getChucDanhDisplayName(chucDanh) ||
    getBoPhanDisplayName(boPhan) ||
    cleanValue(hopDongLaoDong?.Ref_BoPhan) ||
    cleanValue(nhanSu?.Ref_ChucDanh) ||
    cleanValue(nhanSu?.Ref_BoPhan);

  return {
    raw: row,
    rawNhanSu: nhanSu || null,
    rawHopDongLaoDong: hopDongLaoDong || null,
    rawDonVi: donVi || null,
    idChamDutHD,
    refNhanSu: nhanSuId,
    refHopDongLaoDong: hopDongLaoDongId,
    refNguoiKy: nguoiKyId,
    soQuyetDinh: cleanValue(row?.SoQuyetDinh) || idChamDutHD,
    ngayQuyetDinh,
    ngayQuyetDinhText: formatAdministrativeDateString(row?.NgayQuyetDinh),
    diaDiemQuyetDinh: cleanValue(row?.DiaDiemQuyetDinh) || cleanValue(donVi?.TinhThanh) || 'Phú Thọ',
    ngayChamDutText: formatAdministrativeDateString(row?.NgayChamDut),
    hinhThucChamDut: cleanValue(row?.HinhThucChamDut),
    lyDoChamDut: cleanValue(row?.LyDoChamDut),
    trangThaiChamDut: cleanValue(row?.TrangThaiChamDut),
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
    chucDanh: chucDanhText,
    boPhan: getBoPhanDisplayName(boPhan),
    soHopDong: cleanValue(hopDongLaoDong?.SoHopDong) || hopDongLaoDongId,
    ngayKyHopDong: formatAdministrativeDateString(hopDongLaoDong?.NgayKy),
    ghiChu: cleanValue(row?.GhiChu)
  };
}

export function buildChamDutHopDongTemplateData(payload) {
  return {
    ten_don_vi_upper: payload.tenDonViUpper,
    so_quyet_dinh: payload.soQuyetDinh,
    ngay_quyet_dinh: payload.ngayQuyetDinh.day,
    thang_quyet_dinh: payload.ngayQuyetDinh.month,
    nam_quyet_dinh: payload.ngayQuyetDinh.year,
    dia_diem_quyet_dinh: payload.diaDiemQuyetDinh,
    ho_ten_nhan_su: payload.hoTenNhanSu,
    ngay_sinh: payload.ngaySinh,
    chuc_danh: payload.chucDanh,
    dia_chi_nhan_su: payload.diaChiNhanSu,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    ngay_cham_dut: payload.ngayChamDutText,
    ly_do_cham_dut: payload.lyDoChamDut,
    ho_ten_nguoi_ky: payload.hoTenNguoiKy,
    chuc_vu_nguoi_ky: payload.chucVuNguoiKy
  };
}

export async function fetchChamDutHopDongData(idChamDutHD) {
  if (!idChamDutHD) {
    throw new Error('Thiếu tham số ID_ChamDutHD trên URL.');
  }

  const bundle = await fetchChamDutBundle(idChamDutHD);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy dữ liệu với ID_ChamDutHD = ${idChamDutHD}.`);
  }
  const related = bundle.related || {};
  return buildChamDutHopDongPayload(row, {
    hopDongLaoDongById: buildMap(related.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    chucDanhById: buildMap(related.DM_CHUCDANH, 'ID_ChucDanh'),
    boPhanById: buildMap(related.DM_BOPHAN, 'ID_BoPhan')
  });
}
