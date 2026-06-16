const path = require('path');
const ExcelJS = require('exceljs');

const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'public', 'de_nghi_cap_bao_hiem_template.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TAXI 123_HN';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Danh sách xe');
  worksheet.columns = [
    { key: 'stt', width: 8 },
    { key: 'bienSo', width: 24 },
    { key: 'ngayHetHanCu', width: 22 },
    { key: 'ghiChu', width: 34 }
  ];

  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = 'TÊN CÔNG TY BẢO HIỂM:';
  worksheet.getCell('A1').font = { name: 'Times New Roman', size: 14, bold: true };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 24;

  const headers = ['STT', 'Biển số xe', 'Ngày hết hạn cũ', 'Ghi chú'];
  const headerRow = worksheet.getRow(2);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Times New Roman', size: 12, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  headerRow.height = 28;
  headerRow.commit();

  const templateRow = worksheet.getRow(3);
  for (let columnIndex = 1; columnIndex <= 4; columnIndex += 1) {
    const cell = templateRow.getCell(columnIndex);
    cell.font = { name: 'Times New Roman', size: 12 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: columnIndex === 4 ? 'left' : 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }
  templateRow.height = 24;
  templateRow.commit();

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Đã tạo template Excel: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
