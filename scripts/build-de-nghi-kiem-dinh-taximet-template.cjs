const path = require('path');
const ExcelJS = require('exceljs');

const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'public', 'de_nghi_kiem_dinh_taximet_template.xlsx');

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TAXI 123_HN';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Bao_cao');
  worksheet.columns = [
    { key: 'stt', width: 7.63 },
    { key: 'bienSo', width: 13.25 },
    { key: 'maDam', width: 10.13 },
    { key: 'thoiHan', width: 15.13 },
    { key: 'soDangKy', width: 16.38 },
    { key: 'soKhung', width: 23.88 },
    { key: 'soMay', width: 20.75 },
    { key: 'nhanHieu', width: 22 },
    { key: 'namSanXuat', width: 11.38 },
    { key: 'soCho', width: 10.13 },
    { key: 'nuocSanXuat', width: 13.88 },
    { key: 'ngayDangKyLanDau', width: 20.75 },
    { key: 'tenDangKyXe', width: 37.63 }
  ];

  worksheet.mergeCells('A1:M1');
  worksheet.getCell('A1').value = 'DANH SÁCH XE HẾT HẠN KIỂM ĐỊNH ĐỒNG HỒ TAXIMET';
  worksheet.getCell('A1').font = { name: 'Times New Roman', size: 14, bold: true };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25.5;

  const headers = [
    'STT',
    'BIỂN SỐ',
    'MÃ ĐÀM',
    'THỜI HẠN',
    'SỐ ĐĂNG KÝ',
    'SỐ KHUNG',
    'SỐ MÁY',
    'NHÃN HIỆU',
    'NĂM SX',
    'SỐ CHỖ',
    'NƯỚC SX',
    'NGÀY ĐĂNG KÝ XE LẦN ĐẦU',
    'TÊN ĐĂNG KÝ XE'
  ];
  const headerRow = worksheet.getRow(2);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Times New Roman', size: 11, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { argb: 'FFFFFF00' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  headerRow.height = 22.5;
  headerRow.commit();

  const templateRow = worksheet.getRow(3);
  for (let columnIndex = 1; columnIndex <= 13; columnIndex += 1) {
    const cell = templateRow.getCell(columnIndex);
    cell.numFmt = '@';
    cell.font = { name: 'Times New Roman', size: 11 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: [6, 7, 8, 13].includes(columnIndex) ? 'left' : 'center',
      wrapText: false
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }
  templateRow.commit();

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2
    }
  };
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Đã tạo template Excel: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
