import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export const DE_NGHI_CAP_BAO_HIEM_EXCEL_TEMPLATE_URL = '/de_nghi_cap_bao_hiem_template.xlsx?v=20260616';

const BAO_HIEM_REPORT_BASE_TITLE = 'DANH SÁCH XE HẾT HẠN BẢO HIỂM';
const BAO_HIEM_REPORT_COLUMNS = 14;

export function getDeNghiCapBaoHiemIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoBaoHiem') || '';
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

function getCongTyBaoHiemDisplayName(congTyBaoHiem) {
  if (!congTyBaoHiem) return '';
  return cleanValue(congTyBaoHiem.TenCongTyBaoHiem) || cleanValue(congTyBaoHiem.TenVietTat) || cleanValue(congTyBaoHiem.Display) || '';
}

function findCongTyBaoHiemByReference(refValue, congTyBaoHiemById, congTyBaoHiemRows) {
  const ref = cleanValue(refValue);
  if (!ref) return null;

  return (
    congTyBaoHiemById.get(ref) ||
    (Array.isArray(congTyBaoHiemRows) ? congTyBaoHiemRows : []).find((congTyBaoHiem) => (
      cleanValue(congTyBaoHiem?.TenCongTyBaoHiem) === ref ||
      cleanValue(congTyBaoHiem?.TenVietTat) === ref ||
      cleanValue(congTyBaoHiem?.Display) === ref ||
      cleanValue(congTyBaoHiem?.MaBaoHiem) === ref
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
  return cleanMonthYear ? `${BAO_HIEM_REPORT_BASE_TITLE} THÁNG ${cleanMonthYear}` : BAO_HIEM_REPORT_BASE_TITLE;
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

export async function fetchDeNghiCapBaoHiemBundleRow(idHoSoBaoHiem) {
  if (!idHoSoBaoHiem) {
    throw new Error('Thiếu tham số ID_HoSoBaoHiem trên URL.');
  }

  const params = new URLSearchParams({
    ID_HoSoBaoHiem: idHoSoBaoHiem,
    includeRelated: '0'
  });
  const response = await fetch(`/api/de-nghi-cap-bao-hiem?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const data = await readJsonResponse(response, `Không tải được hồ sơ đề nghị cấp bảo hiểm (${response.status}).`);

  if (!data.row) {
    throw new Error(`Không tìm thấy hồ sơ đề nghị cấp bảo hiểm với ID_HoSoBaoHiem = ${idHoSoBaoHiem}.`);
  }

  return data.row;
}

export async function fetchDeNghiCapBaoHiemBundleRelated(row) {
  const idHoSoBaoHiem = cleanValue(row?.ID_HoSoBaoHiem);
  if (!idHoSoBaoHiem) {
    return {
      chiTietRows: [],
      congTyBaoHiemById: new Map(),
      congTyBaoHiemRows: [],
      xeById: new Map()
    };
  }

  const response = await fetch(`/api/de-nghi-cap-bao-hiem?ID_HoSoBaoHiem=${encodeURIComponent(idHoSoBaoHiem)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ID_HoSoBaoHiem: idHoSoBaoHiem,
      row
    })
  });
  const data = await readJsonResponse(response, `Không tải được dữ liệu liên kết (${response.status}).`);

  const related = data.related || {};
  return {
    chiTietRows: Array.isArray(related.CT_HS_DE_NGHI_BAOHIEM) ? related.CT_HS_DE_NGHI_BAOHIEM : [],
    congTyBaoHiemById: buildMap(related.DM_CTY_BAOHIEM || [], 'ID_CongTyBaoHiem'),
    congTyBaoHiemRows: Array.isArray(related.DM_CTY_BAOHIEM) ? related.DM_CTY_BAOHIEM : [],
    xeById: buildMap(related.XE || [], 'ID_Xe')
  };
}

function buildBaoHiemItems(chiTietRows, xeById) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const refXe = cleanValue(row?.Ref_Xe);
    const xe = xeById.get(refXe);

    return {
      stt: String(index + 1),
      bienSo: getXeBienSo(xe),
      maDam: xe ? cleanValue(xe.MaDam) : '',
      loaiBaoHiem: cleanValue(row?.LoaiBaoHiem),
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

export function buildDeNghiCapBaoHiemPayload(row, relatedData = {}) {
  const congTyBaoHiemById = relatedData.congTyBaoHiemById || new Map();
  const congTyBaoHiemRows = Array.isArray(relatedData.congTyBaoHiemRows) ? relatedData.congTyBaoHiemRows : [];
  const xeById = relatedData.xeById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];
  const congTyBaoHiem = findCongTyBaoHiemByReference(row?.Ref_CongTyBaoHiem, congTyBaoHiemById, congTyBaoHiemRows);
  const tenCongTyBaoHiem = getCongTyBaoHiemDisplayName(congTyBaoHiem);
  const danhSachXe = buildBaoHiemItems(chiTietRows, xeById);
  const thangNamBaoCao = getReportMonthYear(chiTietRows);

  return {
    raw: row,
    idHoSoBaoHiem: cleanValue(row?.ID_HoSoBaoHiem),
    soHoSo: cleanValue(row?.SoHoSo),
    ngayLap: formatAdministrativeDate(row?.NgayLap),
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    loaiBaoHiem: cleanValue(row?.LoaiBaoHiem),
    ngayCapMoi: formatAdministrativeDateString(row?.NgayCapMoi),
    ngayHetHanMoi: formatAdministrativeDateString(row?.NgayHetHanMoi),
    trangThaiHoSo: cleanValue(row?.TrangThaiHoSo),
    tenCongTyBaoHiem,
    tenCongTyBaoHiemUpper: tenCongTyBaoHiem.toUpperCase(),
    diaChiCongTyBaoHiem: cleanValue(congTyBaoHiem?.DiaChi),
    nguoiDaiDienCongTyBaoHiem: cleanValue(congTyBaoHiem?.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(congTyBaoHiem?.ChucVuNguoiDaiDien),
    thangNamBaoCao,
    tieuDeBaoCao: buildReportTitle(thangNamBaoCao),
    danhSachXe,
    soLuongXe: danhSachXe.length,
    soLuongXeChuaResolve: danhSachXe.filter((item) => !item.daResolveXe).length
  };
}

export async function buildDeNghiCapBaoHiemExcelWorkbook(ExcelJS, payload) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) {
    throw new Error('Không tìm thấy thư viện ExcelJS.');
  }

  const response = await fetch(DE_NGHI_CAP_BAO_HIEM_EXCEL_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error('Không thể tải file mẫu Excel danh sách xe đề nghị cấp bảo hiểm.');
  }

  const templateContent = await response.arrayBuffer();
  const workbook = new Workbook();
  await workbook.xlsx.load(templateContent);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File mẫu Excel không có sheet dữ liệu.');
  }

  worksheet.getCell('A1').value = payload.tieuDeBaoCao || BAO_HIEM_REPORT_BASE_TITLE;

  const columnCount = Math.max(worksheet.columnCount || BAO_HIEM_REPORT_COLUMNS, BAO_HIEM_REPORT_COLUMNS);
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
      item.loaiBaoHiem,
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

export function buildDeNghiCapBaoHiemExcelFileName(payload) {
  const fileToken = cleanValue(payload?.soHoSo || payload?.idHoSoBaoHiem || 'new').replace(/[\\/:*?"<>|]/g, '_');
  return `Bao_cao_BAOHIEM_het_han_${fileToken}.xlsx`;
}
