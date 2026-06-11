import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const TABLE_CHAM_DUT_HOP_DONG = 'NHANSU_CHAMDUT_HOPDONG';
const TABLE_HOP_DONG_LAO_DONG = 'NHANSU_HOPDONG_LAODONG';
const TABLE_NHAN_SU = 'NHANSU';
const TABLE_DON_VI = 'DONVI';
const TABLE_CHUC_DANH = 'DM_CHUCDANH';
const TABLE_BO_PHAN = 'DM_BOPHAN';

export function getChamDutHopDongIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ChamDutHD') || '';
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

async function fetchRelatedMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
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

export async function fetchChamDutHopDongRow(appSheetService, idChamDutHD) {
  if (!idChamDutHD) {
    throw new Error('Thiếu tham số ID_ChamDutHD trên URL.');
  }

  try {
    const bundle = await fetchChamDutBundle(idChamDutHD, { includeRelated: false });
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy quyết định chấm dứt HĐLĐ với ID_ChamDutHD = ${idChamDutHD}.`);
    }

    return row;
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const selector = buildEqualsSelector(TABLE_CHAM_DUT_HOP_DONG, 'ID_ChamDutHD', idChamDutHD);
  const rows = await appSheetService.find(TABLE_CHAM_DUT_HOP_DONG, selector);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy quyết định chấm dứt HĐLĐ với ID_ChamDutHD = ${idChamDutHD}.`);
  }

  return row;
}

export async function fetchChamDutHopDongRelated(appSheetService, row) {
  const idChamDutHD = cleanValue(row?.ID_ChamDutHD);

  if (idChamDutHD) {
    try {
      const bundle = await fetchChamDutBundle(idChamDutHD, { sourceRow: row });
      return {
        hopDongLaoDongById: buildMap(bundle.related?.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong'),
        nhanSuById: buildMap(bundle.related?.NHANSU, 'ID_NhanSu'),
        donViById: buildMap(bundle.related?.DONVI, 'ID_DonVi'),
        chucDanhById: buildMap(bundle.related?.DM_CHUCDANH, 'ID_ChucDanh'),
        boPhanById: buildMap(bundle.related?.DM_BOPHAN, 'ID_BoPhan')
      };
    } catch {
      // Giữ fallback cũ để trang vẫn chạy được nếu môi trường chưa có bundle API.
    }
  }

  if (!appSheetService) {
    return {
      hopDongLaoDongById: new Map(),
      nhanSuById: new Map(),
      donViById: new Map(),
      chucDanhById: new Map(),
      boPhanById: new Map()
    };
  }

  const [hopDongLaoDongById, nhanSuById] = await Promise.all([
    fetchRelatedMap(appSheetService, TABLE_HOP_DONG_LAO_DONG, 'ID_HopDongLaoDong', [row?.Ref_HopDongLD]),
    fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', [row?.Ref_NhanSu, row?.Ref_NguoiKy])
  ]);
  const nhanSu = nhanSuById.get(cleanValue(row?.Ref_NhanSu));
  const nguoiKy = nhanSuById.get(cleanValue(row?.Ref_NguoiKy));
  const hopDongLaoDong = hopDongLaoDongById.get(cleanValue(row?.Ref_HopDongLD));
  const donViId = getDonViId(hopDongLaoDong, nhanSu);

  const [donViById, chucDanhById] = await Promise.all([
    fetchRelatedMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', [donViId]),
    fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', [
      nhanSu?.Ref_ChucDanh,
      nguoiKy?.Ref_ChucDanh,
      hopDongLaoDong?.Ref_BoPhan,
      nhanSu?.Ref_BoPhan
    ])
  ]);
  const chucDanh = chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) || chucDanhById.get(cleanValue(hopDongLaoDong?.Ref_BoPhan));
  const nguoiKyChucDanh = chucDanhById.get(cleanValue(nguoiKy?.Ref_ChucDanh));
  const boPhanById = chucDanh
    ? new Map()
    : await fetchRelatedMap(appSheetService, TABLE_BO_PHAN, 'ID_BoPhan', [
        nhanSu?.Ref_BoPhan,
        hopDongLaoDong?.Ref_BoPhan,
        chucDanh?.Ref_BoPhan,
        nguoiKyChucDanh?.Ref_BoPhan
      ]);

  return { hopDongLaoDongById, nhanSuById, donViById, chucDanhById, boPhanById };
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

export async function fetchChamDutHopDongData(appSheetService, idChamDutHD) {
  if (!idChamDutHD) {
    throw new Error('Thiếu tham số ID_ChamDutHD trên URL.');
  }

  try {
    const bundle = await fetchChamDutBundle(idChamDutHD);
    const row = bundle.row || null;

    if (!row) {
      throw new Error(`Không tìm thấy quyết định chấm dứt HĐLĐ với ID_ChamDutHD = ${idChamDutHD}.`);
    }

    let hopDongLaoDongById = buildMap(bundle.related?.NHANSU_HOPDONG_LAODONG, 'ID_HopDongLaoDong');
    let nhanSuById = buildMap(bundle.related?.NHANSU, 'ID_NhanSu');
    let donViById = buildMap(bundle.related?.DONVI, 'ID_DonVi');
    let chucDanhById = buildMap(bundle.related?.DM_CHUCDANH, 'ID_ChucDanh');
    let boPhanById = buildMap(bundle.related?.DM_BOPHAN, 'ID_BoPhan');

    if (appSheetService) {
      const missingHopDongIds = [row.Ref_HopDongLD].map(cleanValue).filter((id) => id && !hopDongLaoDongById.has(id));
      const missingNhanSuIds = [row.Ref_NhanSu, row.Ref_NguoiKy].map(cleanValue).filter((id) => id && !nhanSuById.has(id));

      if (missingHopDongIds.length > 0 || missingNhanSuIds.length > 0) {
        const [extraHopDongById, extraNhanSuById] = await Promise.all([
          missingHopDongIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_HOP_DONG_LAO_DONG, 'ID_HopDongLaoDong', missingHopDongIds)
            : Promise.resolve(new Map()),
          missingNhanSuIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_NHAN_SU, 'ID_NhanSu', missingNhanSuIds)
            : Promise.resolve(new Map())
        ]);
        hopDongLaoDongById = mergeMaps(hopDongLaoDongById, extraHopDongById);
        nhanSuById = mergeMaps(nhanSuById, extraNhanSuById);
      }

      const hopDongLaoDong = hopDongLaoDongById.get(cleanValue(row.Ref_HopDongLD));
      const nhanSu = nhanSuById.get(cleanValue(row.Ref_NhanSu));
      const nguoiKy = nhanSuById.get(cleanValue(row.Ref_NguoiKy));
      const donViId = getDonViId(hopDongLaoDong, nhanSu);
      const missingDonViIds = [donViId].filter((id) => id && !donViById.has(id));
      const missingChucDanhIds = [nhanSu?.Ref_ChucDanh, nguoiKy?.Ref_ChucDanh, hopDongLaoDong?.Ref_BoPhan, nhanSu?.Ref_BoPhan]
        .map(cleanValue)
        .filter((id) => id && !chucDanhById.has(id));

      if (missingDonViIds.length > 0 || missingChucDanhIds.length > 0) {
        const [extraDonViById, extraChucDanhById] = await Promise.all([
          missingDonViIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', missingDonViIds)
            : Promise.resolve(new Map()),
          missingChucDanhIds.length > 0
            ? fetchRelatedMap(appSheetService, TABLE_CHUC_DANH, 'ID_ChucDanh', missingChucDanhIds)
            : Promise.resolve(new Map())
        ]);
        donViById = mergeMaps(donViById, extraDonViById);
        chucDanhById = mergeMaps(chucDanhById, extraChucDanhById);
      }

      const chucDanh = chucDanhById.get(cleanValue(nhanSu?.Ref_ChucDanh)) || chucDanhById.get(cleanValue(hopDongLaoDong?.Ref_BoPhan));
      const nguoiKyChucDanh = chucDanhById.get(cleanValue(nguoiKy?.Ref_ChucDanh));
      const missingBoPhanIds = [nhanSu?.Ref_BoPhan, hopDongLaoDong?.Ref_BoPhan, chucDanh?.Ref_BoPhan, nguoiKyChucDanh?.Ref_BoPhan]
        .map(cleanValue)
        .filter((id) => id && !boPhanById.has(id));

      if (missingBoPhanIds.length > 0) {
        boPhanById = mergeMaps(
          boPhanById,
          await fetchRelatedMap(appSheetService, TABLE_BO_PHAN, 'ID_BoPhan', missingBoPhanIds)
        );
      }
    }

    return buildChamDutHopDongPayload(row, { hopDongLaoDongById, nhanSuById, donViById, chucDanhById, boPhanById });
  } catch (error) {
    if (!appSheetService) throw error;
  }

  const row = await fetchChamDutHopDongRow(appSheetService, idChamDutHD);
  const related = await fetchChamDutHopDongRelated(appSheetService, row);
  return buildChamDutHopDongPayload(row, related);
}
