import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export const DE_NGHI_KIEM_DINH_TAXIMET_EXCEL_TEMPLATE_URL = '/de_nghi_kiem_dinh_taximet_template.xlsx?v=20260616';

const TAXIMET_REPORT_BASE_TITLE = 'DANH SÁCH XE HẾT HẠN KIỂM ĐỊNH ĐỒNG HỒ TAXIMET';
const TAXIMET_REPORT_COLUMNS = 13;

export function getDeNghiKiemDinhTaximetIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoTaximet') || '';
}

export function cleanValue(value) {
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

function getDonViKiemDinhDisplayName(donViKiemDinh) {
  if (!donViKiemDinh) return '';
  return cleanValue(donViKiemDinh.TenDonVI) || cleanValue(donViKiemDinh.Display) || cleanValue(donViKiemDinh.DiaChi) || '';
}

function findDonViKiemDinhByReference(refValue, donViKiemDinhById, donViKiemDinhRows) {
  const ref = cleanValue(refValue);
  if (!ref) return null;

  return (
    donViKiemDinhById.get(ref) ||
    (Array.isArray(donViKiemDinhRows) ? donViKiemDinhRows : []).find((donViKiemDinh) => (
      cleanValue(donViKiemDinh?.TenDonVI) === ref ||
      cleanValue(donViKiemDinh?.Display) === ref
    )) ||
    null
  );
}

function getXeBienSo(xe) {
  if (!xe) return '';
  return cleanValue(xe.BienSo) || cleanValue(xe.Display) || '';
}

function getReportMonthYear(chiTietRows) {
  const firstDateRow = (Array.isArray(chiTietRows) ? chiTietRows : []).find((row) => {
    const date = formatAdministrativeDate(row?.NgayHetHanCu);
    return date.month && date.year;
  });
  const date = formatAdministrativeDate(firstDateRow?.NgayHetHanCu);
  if (!date.month || !date.year) return '';
  return `${date.month}/${date.year}`;
}

function buildReportTitle(monthYear) {
  const cleanMonthYear = cleanValue(monthYear);
  return cleanMonthYear ? `${TAXIMET_REPORT_BASE_TITLE} THÁNG ${cleanMonthYear}` : TAXIMET_REPORT_BASE_TITLE;
}

function cloneStyle(style) {
  return style ? JSON.parse(JSON.stringify(style)) : {};
}

function copyRowStyle(sourceRow, targetRow, columnCount) {
  targetRow.height = sourceRow.height;
  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    targetRow.getCell(columnIndex).style = cloneStyle(sourceRow.getCell(columnIndex).style);
  }
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

export async function fetchDeNghiKiemDinhTaximetBundleRow(idHoSoTaximet) {
  if (!idHoSoTaximet) {
    throw new Error('Thiếu tham số ID_HoSoTaximet trên URL.');
  }

  const params = new URLSearchParams({
    ID_HoSoTaximet: idHoSoTaximet,
    includeRelated: '0'
  });
  const response = await fetch(`/api/de-nghi-kiem-dinh-taximet?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const data = await readJsonResponse(response, `Không tải được hồ sơ đề nghị kiểm định taximet (${response.status}).`);

  if (!data.row) {
    throw new Error(`Không tìm thấy hồ sơ đề nghị kiểm định taximet với ID_HoSoTaximet = ${idHoSoTaximet}.`);
  }

  return data.row;
}

export async function fetchDeNghiKiemDinhTaximetBundleRelated(row) {
  const idHoSoTaximet = cleanValue(row?.ID_HoSoTaximet);
  if (!idHoSoTaximet) {
    return {
      chiTietRows: [],
      donViKiemDinhById: new Map(),
      donViKiemDinhRows: [],
      xeById: new Map()
    };
  }

  const response = await fetch(`/api/de-nghi-kiem-dinh-taximet?ID_HoSoTaximet=${encodeURIComponent(idHoSoTaximet)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ID_HoSoTaximet: idHoSoTaximet,
      row
    })
  });
  const data = await readJsonResponse(response, `Không tải được dữ liệu liên kết (${response.status}).`);

  const related = data.related || {};
  return {
    chiTietRows: Array.isArray(related.CT_HS_KIEMDINH_TAXIMET) ? related.CT_HS_KIEMDINH_TAXIMET : [],
    donViKiemDinhById: buildMap(related.DM_CQKD_TAXIMET || [], 'ID_CQKD'),
    donViKiemDinhRows: Array.isArray(related.DM_CQKD_TAXIMET) ? related.DM_CQKD_TAXIMET : [],
    xeById: buildMap(related.XE || [], 'ID_Xe')
  };
}

function buildTaximetItems(chiTietRows, xeById) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const refXe = cleanValue(row?.Ref_Xe);
    const xe = xeById.get(refXe);

    return {
      stt: String(index + 1),
      bienSo: getXeBienSo(xe),
      maDam: xe ? cleanValue(xe.MaDam) : '',
      thoiHan: formatAdministrativeDateString(row?.NgayHetHanCu),
      soDangKy: xe ? cleanValue(xe.SoGCNDangKyXe) : '',
      soKhung: xe ? cleanValue(xe.SoKhung) : '',
      soMay: xe ? cleanValue(xe.SoMay) : '',
      nhanHieu: xe ? cleanValue(xe.NhanHieu) : '',
      namSanXuat: xe ? cleanValue(xe.NamSanXuat) : '',
      soCho: xe ? cleanValue(xe.SoCho) : '',
      nuocSanXuat: xe ? cleanValue(xe.NuocSX) : '',
      ngayDangKyLanDau: xe ? formatAdministrativeDateString(xe.NgayDangKyXeLanDau) : '',
      tenDangKyXe: xe ? cleanValue(xe.TenDangKyXe) : '',
      daResolveXe: Boolean(xe)
    };
  });
}

export function buildDeNghiKiemDinhTaximetPayload(row, relatedData = {}) {
  const donViKiemDinhById = relatedData.donViKiemDinhById || new Map();
  const donViKiemDinhRows = Array.isArray(relatedData.donViKiemDinhRows) ? relatedData.donViKiemDinhRows : [];
  const xeById = relatedData.xeById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];
  const donViKiemDinh = findDonViKiemDinhByReference(row?.Ref_DonViKiemDinh, donViKiemDinhById, donViKiemDinhRows);
  const tenDonViKiemDinh = getDonViKiemDinhDisplayName(donViKiemDinh);
  const danhSachXe = buildTaximetItems(chiTietRows, xeById);
  const thangNamBaoCao = getReportMonthYear(chiTietRows);

  return {
    raw: row,
    idHoSoTaximet: cleanValue(row?.ID_HoSoTaximet),
    soHoSo: cleanValue(row?.SoHoSo),
    ngayLap: formatAdministrativeDate(row?.NgayLap),
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    loaiKiemDinh: cleanValue(row?.LoaiKiemDinh),
    ngayKiemDinhMoi: formatAdministrativeDateString(row?.NgayKiemDinhMoi),
    ngayHetHanMoi: formatAdministrativeDateString(row?.NgayHetHanMoi),
    trangThaiHoSo: cleanValue(row?.TrangThaiHoSo),
    tenDonViKiemDinh,
    tenDonViKiemDinhUpper: tenDonViKiemDinh.toUpperCase(),
    diaChiDonViKiemDinh: cleanValue(donViKiemDinh?.DiaChi),
    nguoiDaiDienDonViKiemDinh: cleanValue(donViKiemDinh?.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(donViKiemDinh?.ChucVuNguoiDaiDien),
    thangNamBaoCao,
    tieuDeBaoCao: buildReportTitle(thangNamBaoCao),
    danhSachXe,
    soLuongXe: danhSachXe.length,
    soLuongXeChuaResolve: danhSachXe.filter((item) => !item.daResolveXe).length
  };
}

export async function buildDeNghiKiemDinhTaximetExcelWorkbook(ExcelJS, payload) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) {
    throw new Error('Không tìm thấy thư viện ExcelJS.');
  }

  const response = await fetch(DE_NGHI_KIEM_DINH_TAXIMET_EXCEL_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error('Không thể tải file mẫu Excel danh sách xe đề nghị kiểm định taximet.');
  }

  const templateContent = await response.arrayBuffer();
  const workbook = new Workbook();
  await workbook.xlsx.load(templateContent);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File mẫu Excel không có sheet dữ liệu.');
  }

  worksheet.getCell('A1').value = payload.tieuDeBaoCao || TAXIMET_REPORT_BASE_TITLE;

  const columnCount = Math.max(worksheet.columnCount || TAXIMET_REPORT_COLUMNS, TAXIMET_REPORT_COLUMNS);
  const templateRow = worksheet.getRow(3);
  const sourceStyleRow = templateRow;
  const totalRows = Math.max(worksheet.rowCount, payload.danhSachXe.length + 2, 3);

  for (let rowNumber = 3; rowNumber <= totalRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    copyRowStyle(sourceStyleRow, row, columnCount);
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      row.getCell(columnIndex).value = null;
    }
    row.commit();
  }

  payload.danhSachXe.forEach((item, index) => {
    const row = worksheet.getRow(index + 3);
    copyRowStyle(sourceStyleRow, row, columnCount);
    [
      item.stt,
      item.bienSo,
      item.maDam,
      item.thoiHan,
      item.soDangKy,
      item.soKhung,
      item.soMay,
      item.nhanHieu,
      item.namSanXuat,
      item.soCho,
      item.nuocSanXuat,
      item.ngayDangKyLanDau,
      item.tenDangKyXe
    ].forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.commit();
  });

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  return workbook;
}

export function buildDeNghiKiemDinhTaximetExcelFileName(payload) {
  const fileToken = cleanValue(payload?.soHoSo || payload?.idHoSoTaximet || 'new').replace(/[\\/:*?"<>|]/g, '_');
  return `Bao_cao_taximet_het_han_${fileToken}.xlsx`;
}
