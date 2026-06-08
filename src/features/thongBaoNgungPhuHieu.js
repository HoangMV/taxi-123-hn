import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const TABLE_THONG_BAO = 'XE_THONGBAO_NGUNG';
const TABLE_CHI_TIET = 'XE_THONGBAO_NGUNG_CHITIET';
const TABLE_DON_VI = 'DONVI';
const TABLE_XE = 'XE';
const TABLE_PHU_HIEU = 'XE_PHUHIEU';

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

function escapeSelectorValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function buildEqualsSelector(tableName, keyName, value) {
  const cleanId = cleanValue(value);
  if (!cleanId) return '';
  return `Filter(${tableName}, [${keyName}] = "${escapeSelectorValue(cleanId)}")`;
}

function buildRefSelector(tableName, keyName, ids) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map(cleanValue).filter(Boolean))];
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

async function fetchMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
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

export async function fetchThongBaoNgungRow(appSheetService, idThongBaoNgung) {
  if (!idThongBaoNgung) {
    throw new Error('Thiếu tham số ID_ThongBaoNgung trên URL.');
  }

  const selector = buildEqualsSelector(TABLE_THONG_BAO, 'ID_ThongBaoNgung', idThongBaoNgung);
  const rows = await appSheetService.find(TABLE_THONG_BAO, selector);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy thông báo ngừng phù hiệu với ID_ThongBaoNgung = ${idThongBaoNgung}.`);
  }

  return row;
}

export async function fetchThongBaoNgungRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      chiTietRows: [],
      donViById: new Map(),
      xeById: new Map(),
      phuHieuById: new Map()
    };
  }

  const chiTietRows = await appSheetService.find(
    TABLE_CHI_TIET,
    buildEqualsSelector(TABLE_CHI_TIET, 'Ref_ThongBaoNgung', row?.ID_ThongBaoNgung)
  );

  const [donViById, xeById, phuHieuById] = await Promise.all([
    fetchMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', [row?.Ref_DonVi]),
    fetchMap(
      appSheetService,
      TABLE_XE,
      'ID_Xe',
      (Array.isArray(chiTietRows) ? chiTietRows : []).map((chiTiet) => chiTiet?.Ref_Xe)
    ),
    fetchMap(
      appSheetService,
      TABLE_PHU_HIEU,
      'ID_PhuHieu',
      (Array.isArray(chiTietRows) ? chiTietRows : []).map((chiTiet) => chiTiet?.Ref_PhuHieu)
    )
  ]);

  return {
    chiTietRows: Array.isArray(chiTietRows) ? chiTietRows : [],
    donViById,
    xeById,
    phuHieuById
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
