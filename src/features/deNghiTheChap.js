import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

export const DE_NGHI_THE_CHAP_EXCEL_TEMPLATE_URL = '/de_nghi_the_chap_template.xlsx?v=20260615';

export function getDeNghiTheChapIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoTheChap') || '';
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

function buildNhanSuByXeId(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const refXe = cleanValue(row?.Ref_XeHienTai);
    if (refXe && !map.has(refXe)) map.set(refXe, row);
  });
  return map;
}

function getXeBienSo(xe) {
  if (!xe) return '';
  return cleanValue(xe.BienSo) || cleanValue(xe.Display) || '';
}

function getNganHangDisplayName(nganHang) {
  if (!nganHang) return '';
  return cleanValue(nganHang.TenNganHang) || cleanValue(nganHang.TenVietTat) || cleanValue(nganHang.Display) || '';
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
    throw new Error(data.error || fallbackMessage || 'Yêu cầu thất bại (' + response.status + ').');
  }

  return data;
}

export async function fetchDeNghiTheChapBundleRow(idHoSoTheChap) {
  if (!idHoSoTheChap) {
    throw new Error('Thiếu tham số ID_HoSoTheChap trên URL.');
  }

  const params = new URLSearchParams({
    ID_HoSoTheChap: idHoSoTheChap,
    includeRelated: '0'
  });
  const response = await fetch('/api/de-nghi-the-chap?' + params.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const data = await readJsonResponse(response, 'Không tải được hồ sơ đề nghị thế chấp (' + response.status + ').');

  if (!data.row) {
    throw new Error('Không tìm thấy hồ sơ đề nghị thế chấp với ID_HoSoTheChap = ' + idHoSoTheChap + '.');
  }

  return data.row;
}

export async function fetchDeNghiTheChapBundleRelated(row) {
  const idHoSoTheChap = cleanValue(row?.ID_HoSoTheChap);
  if (!idHoSoTheChap) {
    return {
      chiTietRows: [],
      xeById: new Map(),
      nganHangById: new Map(),
      theChapById: new Map(),
      donViById: new Map(),
      nhanSuByXeId: new Map()
    };
  }

  const params = new URLSearchParams({
    ID_HoSoTheChap: idHoSoTheChap,
    includeHiddenRefs: '0'
  });
  const response = await fetch('/api/de-nghi-the-chap?' + params.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ID_HoSoTheChap: idHoSoTheChap,
      includeHiddenRefs: '0',
      row
    })
  });
  const data = await readJsonResponse(response, 'Không tải được dữ liệu liên kết (' + response.status + ').');
  const related = data.related || {};

  return {
    chiTietRows: Array.isArray(related.XE_THECHAP_HOSO_CHITIET) ? related.XE_THECHAP_HOSO_CHITIET : [],
    xeById: buildMap(related.XE || [], 'ID_Xe'),
    nganHangById: buildMap(related.DM_NGANHANG || [], 'ID_NganHang'),
    theChapById: buildMap(related.XE_THECHAP_NGANHANG || [], 'ID_TheChap'),
    donViById: buildMap(related.DONVI || [], 'ID_DonVi'),
    nhanSuByXeId: buildNhanSuByXeId(related.NHANSU || [])
  };
}

export async function fetchDeNghiTheChapBundleDetails(row) {
  const idHoSoTheChap = cleanValue(row?.ID_HoSoTheChap);
  if (!idHoSoTheChap) {
    return {
      chiTietRows: [],
      xeById: new Map(),
      nganHangById: new Map(),
      theChapById: new Map(),
      donViById: new Map(),
      nhanSuByXeId: new Map()
    };
  }

  const params = new URLSearchParams({
    ID_HoSoTheChap: idHoSoTheChap,
    includeVisibleRefs: '0',
    includeHiddenRefs: '0'
  });
  const response = await fetch('/api/de-nghi-the-chap?' + params.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ID_HoSoTheChap: idHoSoTheChap,
      includeVisibleRefs: '0',
      includeHiddenRefs: '0',
      row
    })
  });
  const data = await readJsonResponse(response, 'Không tải được danh sách chi tiết (' + response.status + ').');
  const related = data.related || {};

  return {
    chiTietRows: Array.isArray(related.XE_THECHAP_HOSO_CHITIET) ? related.XE_THECHAP_HOSO_CHITIET : [],
    xeById: new Map(),
    nganHangById: new Map(),
    theChapById: new Map(),
    donViById: new Map(),
    nhanSuByXeId: new Map()
  };
}

export async function fetchDeNghiTheChapBundleVisibleRefs(row, chiTietRows = []) {
  const idHoSoTheChap = cleanValue(row?.ID_HoSoTheChap);
  if (!idHoSoTheChap) {
    return {
      chiTietRows: [],
      xeById: new Map(),
      nganHangById: new Map(),
      theChapById: new Map(),
      donViById: new Map(),
      nhanSuByXeId: new Map()
    };
  }

  const params = new URLSearchParams({
    ID_HoSoTheChap: idHoSoTheChap,
    includeHiddenRefs: '0'
  });
  const response = await fetch('/api/de-nghi-the-chap?' + params.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ID_HoSoTheChap: idHoSoTheChap,
      includeHiddenRefs: '0',
      row,
      chiTietRows
    })
  });
  const data = await readJsonResponse(response, 'Không tải được dữ liệu liên kết (' + response.status + ').');
  const related = data.related || {};

  return {
    chiTietRows: Array.isArray(related.XE_THECHAP_HOSO_CHITIET) ? related.XE_THECHAP_HOSO_CHITIET : chiTietRows,
    xeById: buildMap(related.XE || [], 'ID_Xe'),
    nganHangById: buildMap(related.DM_NGANHANG || [], 'ID_NganHang'),
    theChapById: buildMap(related.XE_THECHAP_NGANHANG || [], 'ID_TheChap'),
    donViById: buildMap(related.DONVI || [], 'ID_DonVi'),
    nhanSuByXeId: buildNhanSuByXeId(related.NHANSU || [])
  };
}

function buildTheChapItems(chiTietRows, xeById, nganHangById, theChapById, donViById, nhanSuByXeId) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const refXe = cleanValue(row?.Ref_Xe);
    const xe = xeById.get(refXe);
    const nganHang = nganHangById.get(cleanValue(row?.Ref_NganHangMoi));
    const theChap = theChapById.get(cleanValue(row?.Ref_XeTheChapNganHang));
    const donVi = xe ? (donViById.get(cleanValue(xe.Ref_DonViQuanLyHienTai)) || donViById.get(cleanValue(xe.Ref_DonViChuQuan))) : null;
    const nhanSu = nhanSuByXeId.get(refXe) || null;

    return {
      stt: String(index + 1),
      bienSo: getXeBienSo(xe),
      ngayHetHan: formatAdministrativeDateString(row?.HanTheChapCu),
      nganHangTheChap: getNganHangDisplayName(nganHang),
      ghiChu: cleanValue(row?.GhiChu),
      daResolveXe: Boolean(xe),
      daResolveNganHang: Boolean(nganHang),
      daResolveDonVi: Boolean(donVi),
      daResolveNhanSu: Boolean(nhanSu),
      trangThaiTheChapCu: cleanValue(row?.TrangThaiTheChapCu),
      ketQuaXuLy: cleanValue(row?.KetQuaXuLy),
      canhBaoTheChap: cleanValue(theChap?.CanhBaoTheChap)
    };
  });
}

export function buildDeNghiTheChapPayload(row, relatedData = {}) {
  const xeById = relatedData.xeById || new Map();
  const nganHangById = relatedData.nganHangById || new Map();
  const theChapById = relatedData.theChapById || new Map();
  const donViById = relatedData.donViById || new Map();
  const nhanSuByXeId = relatedData.nhanSuByXeId || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];
  const nganHangHoSo = nganHangById.get(cleanValue(row?.Ref_NganHang));
  const danhSachXe = buildTheChapItems(chiTietRows, xeById, nganHangById, theChapById, donViById, nhanSuByXeId);

  return {
    raw: row,
    idHoSoTheChap: cleanValue(row?.ID_HoSoTheChap),
    soHoSo: cleanValue(row?.SoHoSoTheChap),
    loaiHoSo: cleanValue(row?.LoaiHoSo),
    ngayVanBan: formatAdministrativeDateString(row?.NgayVanBan),
    ngayGiaHan: formatAdministrativeDateString(row?.NgayGiaHan),
    ngayLap: formatAdministrativeDate(row?.NgayLap),
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    trangThaiHoSo: cleanValue(row?.TrangThaiHoSo),
    ghiChuHoSo: cleanValue(row?.GhiChu),
    tenNganHangHoSo: getNganHangDisplayName(nganHangHoSo),
    danhSachXe,
    soLuongXe: danhSachXe.length,
    soLuongXeChuaResolve: danhSachXe.filter((item) => !item.daResolveXe).length,
    soLuongNganHangChuaResolve: danhSachXe.filter((item) => !item.daResolveNganHang).length
  };
}

export async function buildDeNghiTheChapExcelWorkbook(ExcelJS, payload) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) {
    throw new Error('Không tìm thấy thư viện ExcelJS.');
  }

  const response = await fetch(DE_NGHI_THE_CHAP_EXCEL_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error('Không thể tải file mẫu Excel danh sách xe đề nghị thế chấp.');
  }

  const templateContent = await response.arrayBuffer();
  const workbook = new Workbook();
  await workbook.xlsx.load(templateContent);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File mẫu Excel không có sheet dữ liệu.');
  }

  worksheet.getCell('A1').value = 'ĐỀ NGHỊ THẾ CHẤP' + (payload.soHoSo ? ' - ' + payload.soHoSo : '');

  const columnCount = Math.max(worksheet.columnCount || 5, 5);
  const templateRow = worksheet.getRow(3);
  const totalRows = Math.max(worksheet.rowCount, payload.danhSachXe.length + 2, 3);

  for (let rowNumber = 3; rowNumber <= totalRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    copyRowStyle(templateRow, row, columnCount);
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      row.getCell(columnIndex).value = null;
    }
    row.commit();
  }

  payload.danhSachXe.forEach((item, index) => {
    const row = worksheet.getRow(index + 3);
    copyRowStyle(templateRow, row, columnCount);
    [item.stt, item.bienSo, item.ngayHetHan, item.nganHangTheChap, item.ghiChu].forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.commit();
  });

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  return workbook;
}

export function buildDeNghiTheChapExcelFileName(payload) {
  const fileToken = cleanValue(payload?.soHoSo || payload?.idHoSoTheChap || 'new').replace(/[\\/:*?"<>|]/g, '_');
  return 'Danh_sach_xe_de_nghi_the_chap_' + fileToken + '.xlsx';
}
