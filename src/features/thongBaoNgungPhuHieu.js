import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const BUNDLE_ENDPOINT = '/api/thong-bao-ngung-phu-hieu';

export const THONG_BAO_NGUNG_TEMPLATE_CONFIG = {
  HA_NOI: {
    maDonVi: '0104163591',
    label: 'Hà Nội',
    templateUrl: '/thong_bao_ngung_phu_hieu_ha_noi_template.docx?v=20260605',
    diaDanh: 'Hà Nội',
    coQuanNhan: 'Sở Xây dựng TP Hà Nội'
  },
  VINH_PHUC: {
    maDonVi: '0104163591-001',
    label: 'Vĩnh Phúc',
    templateUrl: '/thong_bao_ngung_phu_hieu_vinh_phuc_template.docx?v=20260605',
    diaDanh: 'Phú Thọ',
    coQuanNhan: 'Sở Xây dựng tỉnh Phú Thọ'
  }
};

export function getThongBaoNgungIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_ThongBaoNgung') || '';
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

async function fetchThongBaoNgungBundle(idThongBaoNgung, options = {}) {
  const params = new URLSearchParams({ ID_ThongBaoNgung: idThongBaoNgung });
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
          ID_ThongBaoNgung: idThongBaoNgung,
          includeRelated: options.includeRelated === false ? '0' : '1',
          row: options.row
        })
      }
    : {
        method: 'GET',
        headers: { Accept: 'application/json' }
      };

  const response = await fetch(`${BUNDLE_ENDPOINT}?${params.toString()}`, init);
  return readJsonResponse(response, 'Không tải được dữ liệu thông báo ngừng phù hiệu từ API bundle.');
}

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || cleanValue(donVi.ID_DonVi);
}

function normalizeMaDonVi(value) {
  return cleanValue(value);
}

export function getTemplateConfigByMaDonVi(maDonVi) {
  const normalized = normalizeMaDonVi(maDonVi);
  return Object.values(THONG_BAO_NGUNG_TEMPLATE_CONFIG).find((config) => config.maDonVi === normalized) || null;
}

function formatQuantity(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return '00';
  return String(number).padStart(2, '0');
}

function getLoaiPhuHieuDisplay(value) {
  const text = cleanValue(value);
  if (!text) return 'Xe taxi';
  if (text.toLowerCase() === 'taxi') return 'Xe taxi';
  return text;
}

function buildVehicleItems(chiTietRows, xeById, phuHieuById, donVi) {
  const tenDonVi = getDonViDisplayName(donVi);

  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const xe = xeById.get(cleanValue(row?.Ref_Xe));
    const phuHieu = phuHieuById.get(cleanValue(row?.Ref_PhuHieu));

    return {
      stt: String(index + 1),
      bienSo: cleanValue(xe?.BienSo) || cleanValue(row?.BienSoTaiThoiDiemThongBao) || cleanValue(row?.Ref_Xe),
      soPhuHieu: cleanValue(phuHieu?.SoPhuHieu) || cleanValue(row?.SoPhuHieu) || cleanValue(row?.Ref_PhuHieu),
      hanPhuHieu: formatAdministrativeDateString(phuHieu?.NgayHetHan || row?.ThoiHanPhuHieu),
      donVi: tenDonVi,
      lyDo: cleanValue(row?.LyDoNgungChiTiet),
      loaiPhuHieu: cleanValue(phuHieu?.LoaiPhuHieu)
    };
  });
}

export async function fetchThongBaoNgungRow(idThongBaoNgung) {
  if (!idThongBaoNgung) {
    throw new Error('Thiếu tham số ID_ThongBaoNgung trên URL.');
  }

  const bundle = await fetchThongBaoNgungBundle(idThongBaoNgung, { includeRelated: false });
  const row = bundle.row || null;

  if (!row) {
    throw new Error(`Không tìm thấy thông báo ngừng phù hiệu với ID_ThongBaoNgung = ${idThongBaoNgung}.`);
  }

  return row;
}

export async function fetchThongBaoNgungRelated(row) {
  const idThongBaoNgung = cleanValue(row?.ID_ThongBaoNgung);
  if (idThongBaoNgung) {
    const bundle = await fetchThongBaoNgungBundle(idThongBaoNgung, { row });
    return {
      chiTietRows: Array.isArray(bundle.related?.XE_THONGBAO_NGUNG_CHITIET) ? bundle.related.XE_THONGBAO_NGUNG_CHITIET : [],
      donViById: buildMap(bundle.related?.DONVI, 'ID_DonVi'),
      xeById: buildMap(bundle.related?.XE, 'ID_Xe'),
      phuHieuById: buildMap(bundle.related?.XE_PHUHIEU, 'ID_PhuHieu')
    };
  }

  return {
    chiTietRows: [],
    donViById: new Map(),
    xeById: new Map(),
    phuHieuById: new Map()
  };
}

export function buildThongBaoNgungPayload(row, relatedData = {}) {
  const donViById = relatedData.donViById || new Map();
  const xeById = relatedData.xeById || new Map();
  const phuHieuById = relatedData.phuHieuById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];
  const donVi = donViById.get(cleanValue(row?.Ref_DonVi));
  const maDonVi = cleanValue(donVi?.MaDonVi) || cleanValue(donVi?.MaSoThue);
  const templateConfig = getTemplateConfigByMaDonVi(maDonVi);
  const ngayThongBao = formatAdministrativeDate(row?.NgayThongBao);
  const danhSachXe = buildVehicleItems(chiTietRows, xeById, phuHieuById, donVi);
  const loaiPhuHieu = getLoaiPhuHieuDisplay(danhSachXe.find((item) => item.loaiPhuHieu)?.loaiPhuHieu);

  return {
    raw: row,
    rawDonVi: donVi || null,
    idThongBaoNgung: cleanValue(row?.ID_ThongBaoNgung),
    soThongBao: cleanValue(row?.SoThongBao),
    ngayThongBao,
    ngayThongBaoText: formatAdministrativeDateString(row?.NgayThongBao),
    ngayBatDauNgungText: formatAdministrativeDateString(row?.NgayBatDauNgung),
    maDonVi,
    tenDonVi: getDonViDisplayName(donVi),
    tenDonViUpper: getDonViDisplayName(donVi).toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    soDienThoai: cleanValue(donVi?.SoDienThoai),
    nguoiDaiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    coQuanNhanThongBao: cleanValue(row?.CoQuanNhanThongBao) || templateConfig?.coQuanNhan || '',
    diaDanhLapThongBao: templateConfig?.diaDanh || '',
    templateConfig,
    templateLabel: templateConfig?.label || '',
    danhSachXe,
    soLuongXe: danhSachXe.length,
    soLuongXeText: formatQuantity(danhSachXe.length),
    loaiPhuHieu
  };
}

export function buildThongBaoNgungTemplateData(payload) {
  return {
    so_thong_bao: payload.soThongBao,
    dia_danh_lap_thong_bao: payload.diaDanhLapThongBao,
    ngay_thong_bao_day: payload.ngayThongBao.day,
    ngay_thong_bao_month: payload.ngayThongBao.month,
    ngay_thong_bao_year: payload.ngayThongBao.year,
    co_quan_nhan_thong_bao: payload.coQuanNhanThongBao,
    ten_don_vi: payload.tenDonVi,
    ten_don_vi_upper: payload.tenDonViUpper,
    dia_chi_don_vi: payload.diaChiDonVi,
    so_dien_thoai: payload.soDienThoai,
    so_luong_xe: payload.soLuongXeText,
    so_luong_phu_hieu_nop_lai: payload.soLuongXeText,
    loai_phu_hieu: payload.loaiPhuHieu,
    danh_sach_xe: payload.danhSachXe.map((item) => ({
      stt: item.stt,
      bien_so: item.bienSo,
      so_phu_hieu: item.soPhuHieu,
      han_phu_hieu: item.hanPhuHieu,
      don_vi: item.donVi,
      ly_do: item.lyDo
    }))
  };
}
