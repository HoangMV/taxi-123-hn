import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const BUNDLE_ENDPOINT = '/api/de-nghi-cap-phu-hieu-xe';

export function getDeNghiCapPhuHieuIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoPhuHieu') || '';
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

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      const preview = text.trim().slice(0, 40).toLowerCase();
      if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.');
      }
      throw new Error(fallbackMessage || 'Không đọc được phản hồi JSON từ API.');
    }
  }

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage || `Yêu cầu thất bại (${response.status}).`);
  }

  return data;
}

async function fetchDeNghiCapPhuHieuBundle(idHoSoPhuHieu, options = {}) {
  const params = new URLSearchParams({ ID_HoSoPhuHieu: idHoSoPhuHieu });
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
          ID_HoSoPhuHieu: idHoSoPhuHieu,
          includeRelated: options.includeRelated === false ? '0' : '1',
          row: options.row
        })
      }
    : {
        method: 'GET',
        headers: { Accept: 'application/json' }
      };

  const response = await fetch(`${BUNDLE_ENDPOINT}?${params.toString()}`, init);
  return readJsonResponse(response, 'Không tải được dữ liệu đề nghị cấp phù hiệu từ API bundle.');
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || cleanValue(donVi.ID_DonVi);
}

function getDonViDiaDanh(donVi) {
  const tinhThanh = cleanValue(donVi?.TinhThanh);
  if (tinhThanh) return tinhThanh.replace(/^(tỉnh|thành phố|tp\.?|tx\.?|thị xã)\s+/i, '');

  const diaChi = cleanValue(donVi?.DiaChi);
  if (!diaChi) return '';

  const parts = diaChi
    .split(',')
    .map((part) => cleanValue(part))
    .filter(Boolean);

  return (parts[parts.length - 1] || '').replace(/^(tỉnh|thành phố|tp\.?|tx\.?|thị xã)\s+/i, '');
}

function getCoQuanDisplayName(coQuan) {
  if (!coQuan) return '';
  return cleanValue(coQuan.TenCoQuanCap) || cleanValue(coQuan.Display) || cleanValue(coQuan.ID_CoQuanCap);
}

function buildXeItems(chiTietRows, xeById, hoSoRow) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const xe = xeById.get(cleanValue(row?.Ref_Xe));

    return {
      stt: String(index + 1),
      bienSo: cleanValue(xe?.BienSo) || cleanValue(row?.BienSo) || cleanValue(row?.Ref_Xe),
      sucChua: cleanValue(xe?.SoCho),
      nhanHieu: cleanValue(xe?.NhanHieu),
      nuocSanXuat: cleanValue(xe?.NuocSX),
      namSanXuat: cleanValue(xe?.NamSanXuat),
      loaiPhuHieu: cleanValue(row?.LoaiPhuHieu) || cleanValue(hoSoRow?.LoaiPhuHieu),
      phuongThucTinhTien: cleanValue(hoSoRow?.PhuongThucTinhTien)
    };
  });
}

export async function fetchDeNghiCapPhuHieuRow(idHoSoPhuHieu) {
  if (!idHoSoPhuHieu) {
    throw new Error('Thiếu tham số ID_HoSoPhuHieu trên URL.');
  }

  const bundle = await fetchDeNghiCapPhuHieuBundle(idHoSoPhuHieu, { includeRelated: false });
  const row = bundle.row || null;

  if (!row) {
    throw new Error(`Không tìm thấy hồ sơ đề nghị cấp phù hiệu với ID_HoSoPhuHieu = ${idHoSoPhuHieu}.`);
  }

  return row;
}

export async function fetchDeNghiCapPhuHieuRelated(row) {
  const idHoSoPhuHieu = cleanValue(row?.ID_HoSoPhuHieu);
  if (idHoSoPhuHieu) {
    const bundle = await fetchDeNghiCapPhuHieuBundle(idHoSoPhuHieu, { row });
    return {
      chiTietRows: Array.isArray(bundle.related?.CT_HS_DE_NGHI_PHUHIEU) ? bundle.related.CT_HS_DE_NGHI_PHUHIEU : [],
      donViById: buildMap(bundle.related?.DONVI, 'ID_DonVi'),
      coQuanCapById: buildMap(bundle.related?.DM_COQUAN_CAP, 'ID_CoQuanCap'),
      xeById: buildMap(bundle.related?.XE, 'ID_Xe')
    };
  }

  return {
    chiTietRows: [],
    donViById: new Map(),
    coQuanCapById: new Map(),
    xeById: new Map()
  };
}

export function buildDeNghiCapPhuHieuPayload(row, relatedData = {}) {
  const donViById = relatedData.donViById || new Map();
  const coQuanCapById = relatedData.coQuanCapById || new Map();
  const xeById = relatedData.xeById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];

  const donVi = donViById.get(cleanValue(row?.Ref_DonViDeNghi));
  const coQuanCap = coQuanCapById.get(cleanValue(row?.Ref_CoQuanCap));
  const danhSachXe = buildXeItems(chiTietRows, xeById, row);
  const ngayLap = formatAdministrativeDate(row?.NgayLap);
  const soHoSo = cleanValue(row?.SoHoSo);
  const tenDonVi = getDonViDisplayName(donVi);

  return {
    raw: row,
    idHoSoPhuHieu: cleanValue(row?.ID_HoSoPhuHieu),
    soHoSo,
    ngayLap,
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    diaDanhLapDon: getDonViDiaDanh(donVi),
    tenCoQuanCap: getCoQuanDisplayName(coQuanCap),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    soDienThoai: cleanValue(donVi?.SoDienThoai),
    maSoThueDonVi: cleanValue(donVi?.MaSoThue),
    nguoiDaiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    nguoiDaiDienDonViUpper: cleanValue(donVi?.NguoiDaiDien).toUpperCase(),
    chucVuNguoiDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    loaiPhuHieu: cleanValue(row?.LoaiPhuHieu),
    hinhThucCap: cleanValue(row?.HinhThucCap),
    phuongThucTinhTien: cleanValue(row?.PhuongThucTinhTien),
    danhSachXe,
    soLuongDeNghiCap: danhSachXe.length
  };
}

export function buildDeNghiCapPhuHieuTemplateData(payload, soLuongNopLai) {
  return {
    so_ho_so: payload.soHoSo,
    dia_danh_lap_don: payload.diaDanhLapDon,
    ngay_lap_day: payload.ngayLap.day,
    ngay_lap_month: payload.ngayLap.month,
    ngay_lap_year: payload.ngayLap.year,
    ten_co_quan_cap: payload.tenCoQuanCap,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    so_dien_thoai: payload.soDienThoai,
    ma_so_thue_don_vi: payload.maSoThueDonVi,
    nguoi_dai_dien_don_vi: payload.nguoiDaiDienDonVi,
    nguoi_dai_dien_don_vi_upper: payload.nguoiDaiDienDonViUpper,
    chuc_vu_nguoi_dai_dien: payload.chucVuNguoiDaiDien,
    loai_phu_hieu_ho_so: payload.loaiPhuHieu,
    hinh_thuc_cap: payload.hinhThucCap,
    phuong_thuc_tinh_tien: payload.phuongThucTinhTien,
    so_luong_nop_lai: cleanValue(soLuongNopLai),
    so_luong_de_nghi_cap: String(payload.soLuongDeNghiCap || 0),
    danh_sach_xe: payload.danhSachXe.map((item) => ({
      stt: item.stt,
      bien_so: item.bienSo,
      suc_chua: item.sucChua,
      nhan_hieu: item.nhanHieu,
      nuoc_san_xuat: item.nuocSanXuat,
      nam_san_xuat: item.namSanXuat,
      loai_phu_hieu: item.loaiPhuHieu,
      phuong_thuc_tinh_tien: item.phuongThucTinhTien
    }))
  };
}
