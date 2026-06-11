const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const outputPath = path.join(publicDir, 'thanh_ly_hop_dong_lao_dong_template.docx');

function normalizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const sourceName = fs
  .readdirSync(publicDir)
  .find((name) => {
    const normalizedName = normalizeFileName(name);
    return (
      name.startsWith('VP - ') &&
      !name.startsWith('~$') &&
      name.endsWith('.docx') &&
      normalizedName.includes('bien ban thanh ly hop dong lao dong')
    );
  });

if (!sourceName && !fs.existsSync(outputPath)) {
  throw new Error('Không tìm thấy file mẫu VP - Biên bản thanh lý hợp đồng lao động.docx hoặc template đã sinh trong thư mục public.');
}

const sourcePath = sourceName ? path.join(publicDir, sourceName) : outputPath;
const zip = new PizZip(fs.readFileSync(sourcePath));
let documentXml = zip.file('word/document.xml')?.asText();

if (!documentXml) {
  throw new Error('Không đọc được word/document.xml trong file mẫu.');
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeXmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const replacements = new Map([
  [0, '{ten_don_vi_upper}'],
  [1, ''],
  [2, ''],
  [3, ''],
  [4, ''],
  [11, 'Số: {so_bien_ban}'],
  [12, ''],
  [13, ''],
  [14, ''],
  [15, ''],
  [16, ''],
  [17, ''],
  [18, ''],
  [20, 'Hôm nay, ngày {ngay_lap} tháng {thang_lap} năm {nam_lap}, tại {ten_don_vi}, chúng tôi gồm:'],
  [21, ''],
  [22, ''],
  [23, ''],
  [24, ''],
  [25, ''],
  [26, ''],
  [27, ''],
  [28, ''],
  [29, ''],
  [30, ''],
  [31, ''],
  [32, ''],
  [35, '{ten_don_vi_upper}'],
  [38, '{dia_chi_don_vi}'],
  [39, ''],
  [42, '{ma_so_thue_don_vi}'],
  [45, 'Ông/Bà {dai_dien_don_vi}                                 Chức danh: {chuc_vu_dai_dien}'],
  [46, ''],
  [47, ''],
  [48, ''],
  [53, 'Ông/Bà {ho_ten_nhan_su}'],
  [54, ''],
  [57, '{dia_chi_nhan_su}'],
  [60, '{so_cccd}'],
  [62, ' {ngay_cap_cccd}'],
  [64, '{noi_cap_cccd}'],
  [66, 'Cùng nhau lập và ký biên bản này để thực hiện việc thanh lý Hợp đồng lao động số: {so_hop_dong_lao_dong} ký ngày {ngay_ky_hop_dong_lao_dong} theo các thoả thuận sau đây:'],
  [67, ''],
  [68, ''],
  [69, ''],
  [70, ''],
  [71, ''],
  [72, ''],
  [73, ''],
  [79, '- {ly_do_thanh_ly}. Hợp đồng lao động chấm dứt kể từ ngày {ngay_cham_dut}. Trạng thái thanh lý: {trang_thai_thanh_ly}.'],
  [80, ''],
  [81, ''],
  [82, ''],
  [83, ''],
  [84, ''],
  [85, ''],
  [86, ''],
  [87, ''],
  [88, ''],
  [89, ''],
  [90, ''],
  [91, ''],
  [92, ''],
  [93, ''],
  [94, '']
]);

if (!sourceName) {
  const oldContractLine = 'Cùng nhau lập và ký biên bản này để thực hiện việc thanh lý Hợp đồng lao động số: {so_hop_dong_lao_dong}/{nam_hop_dong_lao_dong}/HĐLĐ ký ngày {ngay_ky_hop_dong_lao_dong} theo các thoả thuận sau đây:';
  const newContractLine = 'Cùng nhau lập và ký biên bản này để thực hiện việc thanh lý Hợp đồng lao động số: {so_hop_dong_lao_dong} ký ngày {ngay_ky_hop_dong_lao_dong} theo các thoả thuận sau đây:';
  const nextXml = documentXml.replace(escapeXmlText(oldContractLine), escapeXmlText(newContractLine));

  if (nextXml === documentXml) {
    throw new Error('Không tìm thấy dòng placeholder số hợp đồng lao động trong template hiện có.');
  }

  zip.file('word/document.xml', nextXml);
  fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Đã cập nhật template Word: ${outputPath}`);
  return;
}

let index = 0;
const nextXml = documentXml.replace(/<w:t(?=[\s>])([^>]*)>([\s\S]*?)<\/w:t>/g, (match, attrs) => {
  const replacement = replacements.get(index);
  index += 1;

  if (replacement === undefined) return match;
  const xmlSpace = /^\s|\s$/.test(decodeXmlText(replacement)) && !attrs.includes('xml:space')
    ? `${attrs} xml:space="preserve"`
    : attrs;
  return `<w:t${xmlSpace}>${escapeXmlText(replacement)}</w:t>`;
});

if (index < 175) {
  throw new Error(`File mẫu chỉ có ${index} text node, thấp hơn số node cần thay.`);
}

zip.file('word/document.xml', nextXml);
fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Đã tạo template Word: ${outputPath}`);
