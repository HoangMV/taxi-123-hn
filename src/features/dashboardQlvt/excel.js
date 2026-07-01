import { NHAN_SU_COLUMNS, XE_COLUMNS } from './constants';
import { cleanValue } from './filters';

function setSheetStyles(worksheet, columnCount) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, cleanValue(cell.value).length);
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    column.width = Math.min(Math.max(maxLength + 2, 12), 34);
  });
}

export async function buildDashboardExcelWorkbook(ExcelJS, type, rows) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Không tìm thấy thư viện ExcelJS.');
  const columns = type === 'xe' ? XE_COLUMNS : NHAN_SU_COLUMNS;
  const workbook = new Workbook();
  workbook.creator = 'TAXI 123 QLVT';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(type === 'xe' ? 'Báo cáo phương tiện' : 'Báo cáo nhân sự');
  worksheet.columns = columns.map(([key, header]) => ({ key, header }));
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    worksheet.addRow({ ...row, stt: index + 1 });
  });
  setSheetStyles(worksheet, columns.length);
  return workbook;
}

export function buildDashboardExcelFileName(type) {
  const dateToken = new Date().toISOString().slice(0, 10);
  return type === 'xe'
    ? `Bao_cao_phuong_tien_QLVT_${dateToken}.xlsx`
    : `Bao_cao_nhan_su_QLVT_${dateToken}.xlsx`;
}
