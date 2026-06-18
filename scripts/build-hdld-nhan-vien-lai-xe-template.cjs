const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourcePath = path.join(publicDir, 'VP - HĐLĐ Nhân viên lái xe.docx');
const outputPath = path.join(publicDir, 'hdld_nhan_vien_lai_xe_template.docx');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Không tìm thấy file mẫu: ${sourcePath}`);
}

const zip = new PizZip(fs.readFileSync(sourcePath));
const documentXml = zip.file('word/document.xml')?.asText();

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
  [6, '{so_hop_dong}'],
  [7, ''],
  [15, ' {ngay_ky} tháng {thang_ky} năm {nam_ky}'],
  [16, ''],
  [18, 'tại {ten_don_vi}, chúng tôi gồm:'],
  [21, '{ten_don_vi_upper}'],
  [24, '{dia_chi_don_vi}'],
  [25, ''],
  [28, '{ma_so_thue_don_vi}'],
  [31, 'Ông/Bà '],
  [32, '{ho_ten_nguoi_ky}'],
  [34, '{chuc_vu_nguoi_ky}'],
  [42, '{ho_ten_nhan_su}'],
  [45, '{ngay_sinh}'],
  [48, '{dia_chi_nhan_su}'],
  [51, '{so_cccd}'],
  [53, '{ngay_cap_cccd}'],
  [55, '{noi_cap_cccd}'],
  [56, ''],
  [57, ''],
  [60, '{so_gplx}'],
  [61, ''],
  [62, 'Hạng bằng: {hang_gplx}'],
  [78, '{chuc_danh}'],
  [130, '- Loại hợp đồng lao động: {loai_hop_dong}'],
  [131, '.'],
  [132, '- Thời hạn hợp đồng lao động: từ ngày {ngay_bat_dau} đến ngày {ngay_ket_thuc}'],
  [144, '{muc_luong}'],
  [145, 'VNĐ/tháng.']
]);

let index = 0;
const nextXml = documentXml.replace(/<w:t(?=[\s>])([^>]*)>([\s\S]*?)<\/w:t>/g, (match, attrs, text) => {
  const replacement = replacements.get(index);
  index += 1;

  if (replacement === undefined) return match;
  const xmlSpace = /^\s|\s$/.test(decodeXmlText(replacement)) && !attrs.includes('xml:space')
    ? `${attrs} xml:space="preserve"`
    : attrs;
  return `<w:t${xmlSpace}>${escapeXmlText(replacement)}</w:t>`;
});

if (index < 146) {
  throw new Error(`File mẫu chỉ có ${index} text node, thấp hơn số node cần thay.`);
}

zip.file('word/document.xml', nextXml);
fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Đã tạo template Word: ${outputPath}`);
