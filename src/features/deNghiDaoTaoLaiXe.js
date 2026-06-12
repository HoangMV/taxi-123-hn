import { formatAdministrativeDate, formatAdministrativeDateString } from '../lib/dateFormat';

const TABLE_HO_SO = 'HS_DAOTAO';
const TABLE_CHI_TIET = 'CT_HS_DAOTAO';
const TABLE_DON_VI = 'DONVI';
const TABLE_NHAN_SU = 'NHANSU';

export const DE_NGHI_DAO_TAO_EXCEL_TEMPLATE_URL = '/de_nghi_dao_tao_lai_xe_template.xlsx?v=20260612';

export function getDeNghiDaoTaoIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('ID_HoSoDaoTao') || '';
}

export function cleanValue(value) {
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

function getDonViDisplayName(donVi) {
  if (!donVi) return '';
  return cleanValue(donVi.TenDonVi) || cleanValue(donVi.Display) || '';
}

function getNhanSuDisplayName(nhanSu) {
  if (!nhanSu) return '';
  return cleanValue(nhanSu.HoTen) || cleanValue(nhanSu.Display) || '';
}

function getNhanSuAddress(nhanSu) {
  if (!nhanSu) return '';
  return (
    cleanValue(nhanSu.Dia_Chi_Day_Du) ||
    cleanValue(nhanSu.Address) ||
    cleanValue(nhanSu.DiaChiCCCD) ||
    [nhanSu.DiaChiChiTiet_Sau, nhanSu.Xa_Sau, nhanSu.Tinh_Sau]
      .map(cleanValue)
      .filter(Boolean)
      .join(', ')
  );
}

async function fetchMap(appSheetService, tableName, keyName, ids) {
  const selector = buildRefSelector(tableName, keyName, ids);
  if (!selector) return new Map();
  const rows = await appSheetService.find(tableName, selector);
  return buildMap(rows, keyName);
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

export async function fetchDeNghiDaoTaoRow(appSheetService, idHoSoDaoTao) {
  if (!idHoSoDaoTao) {
    throw new Error('Thiếu tham số ID_HoSoDaoTao trên URL.');
  }

  const selector = buildEqualsSelector(TABLE_HO_SO, 'ID_HoSoDaoTao', idHoSoDaoTao);
  const rows = await appSheetService.find(TABLE_HO_SO, selector);
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row) {
    throw new Error(`Không tìm thấy hồ sơ đề nghị đào tạo với ID_HoSoDaoTao = ${idHoSoDaoTao}.`);
  }

  return row;
}

export async function fetchDeNghiDaoTaoRelated(appSheetService, row) {
  if (!appSheetService) {
    return {
      chiTietRows: [],
      donViById: new Map(),
      nhanSuById: new Map()
    };
  }

  const chiTietRows = await appSheetService.find(
    TABLE_CHI_TIET,
    buildEqualsSelector(TABLE_CHI_TIET, 'Ref_HoSoDaoTao', row?.ID_HoSoDaoTao)
  );

  const [donViById, nhanSuById] = await Promise.all([
    fetchMap(appSheetService, TABLE_DON_VI, 'ID_DonVi', [row?.Ref_DonViDeNghi]),
    fetchMap(
      appSheetService,
      TABLE_NHAN_SU,
      'ID_NhanSu',
      (Array.isArray(chiTietRows) ? chiTietRows : []).map((chiTiet) => chiTiet?.Ref_NhanSu)
    )
  ]);

  return {
    chiTietRows: Array.isArray(chiTietRows) ? chiTietRows : [],
    donViById,
    nhanSuById
  };
}

function buildLaiXeItems(chiTietRows, nhanSuById) {
  return (Array.isArray(chiTietRows) ? chiTietRows : []).map((row, index) => {
    const refNhanSu = cleanValue(row?.Ref_NhanSu);
    const nhanSu = nhanSuById.get(refNhanSu);

    return {
      stt: String(index + 1),
      refNhanSu,
      hoTen: getNhanSuDisplayName(nhanSu),
      ngaySinh: formatAdministrativeDateString(nhanSu?.NgaySinh),
      diaChi: getNhanSuAddress(nhanSu),
      soCccd: cleanValue(nhanSu?.CCCD),
      ngayCapCccd: formatAdministrativeDateString(nhanSu?.NgayCapCCCD),
      ghiChu: cleanValue(row?.GhiChu),
      daResolveNhanSu: Boolean(nhanSu)
    };
  });
}

export function buildDeNghiDaoTaoPayload(row, relatedData = {}) {
  const donViById = relatedData.donViById || new Map();
  const nhanSuById = relatedData.nhanSuById || new Map();
  const chiTietRows = Array.isArray(relatedData.chiTietRows) ? relatedData.chiTietRows : [];
  const donVi = donViById.get(cleanValue(row?.Ref_DonViDeNghi));
  const tenDonVi = getDonViDisplayName(donVi);
  const danhSachLaiXe = buildLaiXeItems(chiTietRows, nhanSuById);

  return {
    raw: row,
    idHoSoDaoTao: cleanValue(row?.ID_HoSoDaoTao),
    soHoSo: cleanValue(row?.SoHoSo),
    ngayLap: formatAdministrativeDate(row?.NgayLap),
    ngayLapText: formatAdministrativeDateString(row?.NgayLap),
    noiDungDaoTao: cleanValue(row?.NoiDungDaoTao),
    tenKhoaDaoTao: cleanValue(row?.TenKhoaDaoTao),
    ngayBatDauDaoTao: formatAdministrativeDateString(row?.NgayBatDauDaoTao),
    ngayKetThucDaoTao: formatAdministrativeDateString(row?.NgayKetThucDaoTao),
    trangThaiHoSo: cleanValue(row?.TrangThaiHoSo),
    tenDonVi,
    tenDonViUpper: tenDonVi.toUpperCase(),
    diaChiDonVi: cleanValue(donVi?.DiaChi),
    nguoiDaiDienDonVi: cleanValue(donVi?.NguoiDaiDien),
    chucVuNguoiDaiDien: cleanValue(donVi?.ChucVuNguoiDaiDien),
    danhSachLaiXe,
    soLuongLaiXe: danhSachLaiXe.length,
    soLuongChuaResolve: danhSachLaiXe.filter((item) => !item.daResolveNhanSu).length
  };
}

export async function buildDeNghiDaoTaoExcelWorkbook(ExcelJS, payload) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) {
    throw new Error('Không tìm thấy thư viện ExcelJS.');
  }

  const response = await fetch(DE_NGHI_DAO_TAO_EXCEL_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error('Không thể tải file mẫu Excel danh sách lái xe đề nghị đào tạo.');
  }

  const templateContent = await response.arrayBuffer();
  const workbook = new Workbook();
  await workbook.xlsx.load(templateContent);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File mẫu Excel không có sheet dữ liệu.');
  }

  worksheet.getCell('A1').value = `TÊN ĐƠN VỊ: ${payload.tenDonVi || ''}`;

  const columnCount = Math.max(worksheet.columnCount || 7, 7);
  const templateRow = worksheet.getRow(3);
  const sourceStyleRow = templateRow;
  const totalRows = Math.max(worksheet.rowCount, payload.danhSachLaiXe.length + 2, 3);

  for (let rowNumber = 3; rowNumber <= totalRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    copyRowStyle(sourceStyleRow, row, columnCount);
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      row.getCell(columnIndex).value = null;
    }
    row.commit();
  }

  payload.danhSachLaiXe.forEach((item, index) => {
    const row = worksheet.getRow(index + 3);
    copyRowStyle(sourceStyleRow, row, columnCount);
    const values = [
      item.stt,
      item.hoTen,
      item.ngaySinh,
      item.diaChi,
      item.soCccd,
      item.ngayCapCccd,
      item.ghiChu
    ];
    values.forEach((value, valueIndex) => {
      row.getCell(valueIndex + 1).value = value;
    });
    row.commit();
  });

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  return workbook;
}

export function buildDeNghiDaoTaoExcelFileName(payload) {
  const fileToken = cleanValue(payload?.soHoSo || payload?.idHoSoDaoTao || 'new').replace(/[\\/:*?"<>|]/g, '_');
  return `Danh_sach_lai_xe_de_nghi_dao_tao_${fileToken}.xlsx`;
}
