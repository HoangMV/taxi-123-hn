import { formatAdministrativeDate, formatAdministrativeDateString, parseDateValue } from '../lib/dateFormat';
import { numberToVietnameseWords } from '../lib/numberToVietnamese';

export function getThoaThuanDanSuIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_TTDS') || '';
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

function normalizeVietnameseText(value) {
  return cleanValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function parseApiJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('API /api/thoa-thuan-dan-su không trả JSON. Khi test local, hãy chạy npm run proxy hoặc npm start để proxy /api hoạt động.');
  }
}

async function fetchThoaThuanDanSuBundle(idTtds, options = {}) {
  const params = new URLSearchParams({ ID_TTDS: idTtds });
  if (options.includeRelated === false) {
    params.set('includeRelated', '0');
  }

  const init = options.row
    ? {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ID_TTDS: idTtds,
          includeRelated: options.includeRelated === false ? '0' : '1',
          row: options.row
        })
      }
    : {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      };

  const response = await fetch(`/api/thoa-thuan-dan-su?${params.toString()}`, init);
  const text = await response.text();
  const data = parseApiJson(text);
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dữ liệu thỏa thuận dân sự (${response.status}).`);
  }

  return data;
}

export async function fetchThoaThuanDanSuRow(idTtds) {
  if (!idTtds) {
    throw new Error('Thiếu tham số ID_TTDS trên URL.');
  }

  const bundle = await fetchThoaThuanDanSuBundle(idTtds, { includeRelated: false });
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy thỏa thuận dân sự với ID_TTDS = ${idTtds}.`);
  }
  return row;
}

export async function fetchThoaThuanDanSuRelated(row) {
  const idTtds = cleanValue(row?.ID_TTDS);
  if (!idTtds) {
    return {
      donViById: new Map(),
      nhanSuById: new Map(),
      xeById: new Map(),
      gplxRows: []
    };
  }

  const bundle = await fetchThoaThuanDanSuBundle(idTtds, { row });
  const related = bundle.related || {};
  return {
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    xeById: buildMap(related.XE, 'ID_Xe'),
    gplxRows: related.LAIXE_GPLX || []
  };
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display);
}

function getNhanSuDisplayName(nhanSu) {
  if (!nhanSu) return '';
  return cleanValue(nhanSu.HoTen) || cleanValue(nhanSu.Display);
}

function getNhanSuAddress(nhanSu) {
  return cleanValue(nhanSu?.Dia_Chi_Day_Du) || cleanValue(nhanSu?.Address);
}

function pickGplxForNhanSu(gplxRows, nhanSuId) {
  const targetId = cleanValue(nhanSuId);
  if (!targetId) return null;

  const rows = (Array.isArray(gplxRows) ? gplxRows : []).filter((row) => cleanValue(row?.Ref_NhanSu) === targetId);
  if (rows.length === 0) return null;

  const activeRow = rows.find((row) => normalizeVietnameseText(row?.TrangThai).includes('dang hieu luc'));
  if (activeRow) return activeRow;

  return [...rows].sort((a, b) => {
    const dateA = parseDateValue(a?.NgayHetHan);
    const dateB = parseDateValue(b?.NgayHetHan);
    return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
  })[0] || rows[0];
}

function formatMoney(value) {
  const digits = cleanValue(value).replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

function getMoneyWords(value) {
  const digits = cleanValue(value).replace(/[^\d]/g, '');
  if (!digits) return '';
  return `${numberToVietnameseWords(digits)} đồng`;
}

function buildPeriodText(startText, endText) {
  if (startText && endText) return `từ ngày ${startText} đến ngày ${endText}`;
  if (startText) return `từ ngày ${startText}`;
  if (endText) return `đến ngày ${endText}`;
  return '';
}

function buildWarnings(row, donVi, laiXe, xe, gplx) {
  const warnings = [];
  if (cleanValue(row?.Ref_DonViBenA) && !donVi) warnings.push('Chưa tải được thông tin Bên A từ bảng DONVI.');
  if (cleanValue(row?.Ref_LaiXe) && !laiXe) warnings.push('Chưa tải được thông tin lái xe từ bảng NHANSU.');
  if (cleanValue(row?.Ref_Xe) && !xe) warnings.push('Chưa tải được thông tin xe từ bảng XE.');
  if (cleanValue(row?.Ref_LaiXe) && !gplx) warnings.push('Chưa tải được thông tin GPLX đang hiệu lực từ bảng LAIXE_GPLX.');
  return warnings;
}

export function buildThoaThuanDanSuPayload(row, relatedData = {}) {
  const donViById = relatedData.donViById || new Map();
  const nhanSuById = relatedData.nhanSuById || new Map();
  const xeById = relatedData.xeById || new Map();
  const gplxRows = relatedData.gplxRows || [];

  const donViId = cleanValue(row?.Ref_DonViBenA);
  const laiXeId = cleanValue(row?.Ref_LaiXe);
  const xeId = cleanValue(row?.Ref_Xe);
  const donVi = donViById.get(donViId);
  const laiXe = nhanSuById.get(laiXeId);
  const xe = xeById.get(xeId);
  const gplx = pickGplxForNhanSu(gplxRows, laiXeId);
  const ngayKy = formatAdministrativeDate(row?.NgayKy);
  const ngayKyText = formatAdministrativeDateString(row?.NgayKy);
  const ngayHieuLucText = formatAdministrativeDateString(row?.NgayHieuLuc);
  const ngayHetHanText = formatAdministrativeDateString(row?.NgayHetHan);
  const tenDonVi = getDonViDisplayName(donVi);
  const hoTenLaiXe = getNhanSuDisplayName(laiXe);
  const soTienDatCoc = formatMoney(row?.SoTienDatCoc);

  return {
    raw: row,
    rawDonVi: donVi || null,
    rawLaiXe: laiXe || null,
    rawXe: xe || null,
    rawGplx: gplx || null,
    idTtds: cleanValue(row?.ID_TTDS),
    soThoaThuan: cleanValue(row?.SoThoaThuan),
    ngayKy,
    ngayKyText,
    diaDiemKy: cleanValue(row?.DiaDiemKy) || 'Hà Nội',
    ngayHieuLucText,
    ngayHetHanText,
    thoiHanHieuLucText: buildPeriodText(ngayHieuLucText, ngayHetHanText),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    dienThoaiDonVi: cleanValue(donVi?.SoDienThoai),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue),
    daiDienBenA: cleanValue(donVi?.NguoiDaiDien),
    chucVuBenA: cleanValue(donVi?.ChucVuNguoiDaiDien),
    hoTenLaiXe,
    hoTenLaiXeUpper: hoTenLaiXe.toUpperCase(),
    diaChiLaiXe: getNhanSuAddress(laiXe),
    ngaySinhLaiXe: formatAdministrativeDateString(laiXe?.NgaySinh),
    soCccd: cleanValue(laiXe?.CCCD),
    ngayCapCccd: formatAdministrativeDateString(laiXe?.NgayCapCCCD),
    noiCapCccd: cleanValue(laiXe?.NoiCapCCCD),
    soDienThoaiLaiXe: cleanValue(laiXe?.SoDienThoai),
    soGplx: cleanValue(gplx?.SoGPLX),
    ngayCapGplx: formatAdministrativeDateString(gplx?.NgayCap),
    ngayHetHanGplx: formatAdministrativeDateString(gplx?.NgayHetHan),
    hangGplx: cleanValue(gplx?.HangGPLX),
    bienSoXe: cleanValue(xe?.BienSo),
    maDam: cleanValue(xe?.MaDam),
    nhanHieuXe: cleanValue(xe?.NhanHieu),
    soKhung: cleanValue(xe?.SoKhung),
    soMay: cleanValue(xe?.SoMay),
    namSanXuat: cleanValue(xe?.NamSanXuat),
    mauSon: cleanValue(xe?.MauSon),
    ngayDangKyLanDau: formatAdministrativeDateString(xe?.NgayDangKyXeLanDau),
    hinhThucKhoan: cleanValue(row?.HinhThucKhoan),
    soTienDatCoc,
    soTienDatCocBangChu: getMoneyWords(row?.SoTienDatCoc),
    hinhThucThanhToan: cleanValue(row?.HinhThucThanhToan),
    tyLePhatChamNopNgay: cleanValue(row?.TyLePhatChamNopNgay),
    ghiChu: cleanValue(row?.GhiChu),
    trangThaiThoaThuan: cleanValue(row?.TrangThaiThoaThuan),
    warnings: buildWarnings(row, donVi, laiXe, xe, gplx)
  };
}

export function buildThoaThuanDanSuTemplateData(payload) {
  return {
    dia_diem_ky: payload.diaDiemKy,
    ngay_ky: payload.ngayKy.day,
    thang_ky: payload.ngayKy.month,
    nam_ky: payload.ngayKy.year,
    ngay_ky_text: payload.ngayKyText,
    so_thoa_thuan: payload.soThoaThuan,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    dien_thoai_don_vi: payload.dienThoaiDonVi,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    dai_dien_ben_a: payload.daiDienBenA,
    chuc_vu_ben_a: payload.chucVuBenA,
    ho_ten_lai_xe: payload.hoTenLaiXe,
    ho_ten_lai_xe_upper: payload.hoTenLaiXeUpper,
    dia_chi_lai_xe: payload.diaChiLaiXe,
    ngay_sinh_lai_xe: payload.ngaySinhLaiXe,
    so_cccd: payload.soCccd,
    ngay_cap_cccd: payload.ngayCapCccd,
    noi_cap_cccd: payload.noiCapCccd,
    so_dien_thoai_lai_xe: payload.soDienThoaiLaiXe,
    so_gplx: payload.soGplx,
    ngay_cap_gplx: payload.ngayCapGplx,
    ngay_het_han_gplx: payload.ngayHetHanGplx,
    hang_gplx: payload.hangGplx,
    bien_so_xe: payload.bienSoXe,
    ma_dam: payload.maDam,
    nhan_hieu_xe: payload.nhanHieuXe,
    so_khung: payload.soKhung,
    so_may: payload.soMay,
    nam_san_xuat: payload.namSanXuat,
    mau_son: payload.mauSon,
    ngay_dang_ky_lan_dau: payload.ngayDangKyLanDau,
    hinh_thuc_khoan: payload.hinhThucKhoan,
    so_tien_dat_coc: payload.soTienDatCoc,
    so_tien_dat_coc_bang_chu: payload.soTienDatCocBangChu,
    hinh_thuc_thanh_toan: payload.hinhThucThanhToan,
    ty_le_phat_cham_nop_ngay: payload.tyLePhatChamNopNgay,
    ngay_hieu_luc_text: payload.ngayHieuLucText,
    ngay_het_han_text: payload.ngayHetHanText,
    thoi_han_hieu_luc_text: payload.thoiHanHieuLucText,
    ghi_chu: payload.ghiChu,
    trang_thai_thoa_thuan: payload.trangThaiThoaThuan
  };
}

export async function fetchThoaThuanDanSuData(idTtds) {
  if (!idTtds) {
    throw new Error('Thiếu tham số ID_TTDS trên URL.');
  }

  const bundle = await fetchThoaThuanDanSuBundle(idTtds);
  const row = bundle.row || null;
  if (!row) {
    throw new Error(`Không tìm thấy thỏa thuận dân sự với ID_TTDS = ${idTtds}.`);
  }
  const related = bundle.related || {};
  return buildThoaThuanDanSuPayload(row, {
    donViById: buildMap(related.DONVI, 'ID_DonVi'),
    nhanSuById: buildMap(related.NHANSU, 'ID_NhanSu'),
    xeById: buildMap(related.XE, 'ID_Xe'),
    gplxRows: related.LAIXE_GPLX || []
  });
}

