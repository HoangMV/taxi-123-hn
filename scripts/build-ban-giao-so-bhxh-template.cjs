const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const publicDir = path.resolve(__dirname, '..', 'public');
const source = fs
  .readdirSync(publicDir)
  .find((name) => name.startsWith('VP - ') && name.includes('BHXH') && name.endsWith('.docx'));

if (!source) {
  throw new Error('Khong tim thay file mau VP - ... BHXH.docx trong public.');
}

const sourcePath = path.join(publicDir, source);
const outputPath = path.join(publicDir, 'ban_giao_so_bhxh_template.docx');
const zip = new PizZip(fs.readFileSync(sourcePath));
let xml = zip.file('word/document.xml').asText();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceAt(index, value) {
  return [index, value];
}

const replacements = new Map([
  replaceAt(7, '{ngay_giao_nhan}'),
  replaceAt(11, '{thang_giao_nhan}'),
  replaceAt(14, ' {nam_giao_nhan}'),
  replaceAt(15, ''),
  replaceAt(19, ' {ten_don_vi_giao}'),
  replaceAt(20, ','),
  replaceAt(25, ': {ten_don_vi_giao_upper}'),
  replaceAt(26, ''),
  replaceAt(27, ''),
  replaceAt(28, ''),
  replaceAt(29, ''),
  replaceAt(31, 'M\u00e3 s\u1ed1 thu\u1ebf: {ma_so_thue_don_vi}'),
  replaceAt(32, ''),
  replaceAt(34, '\u0110\u1ecba ch\u1ec9: {dia_chi_don_vi}'),
  replaceAt(39, ' t\u00ean ng\u01b0\u1eddi giao: {ho_ten_nguoi_giao}'),
  replaceAt(52, '{ho_ten_nguoi_lao_dong}'),
  replaceAt(57, '{chuc_vu_nguoi_lao_dong}'),
  replaceAt(59, '\u0110\u1ecba ch\u1ec9: {dia_chi_nguoi_lao_dong}'),
  replaceAt(60, ''),
  replaceAt(67, '{so_cccd}'),
  replaceAt(73, '{ngay_cap_cccd}'),
  replaceAt(78, '{noi_cap_cccd}'),
  replaceAt(87, '{so_so_bhxh}'),
  replaceAt(94, '{so_bia_so}'),
  replaceAt(101, '{so_trang_so_to_roi}'),
  replaceAt(106, '{so_trang_so_to_roi_text}'),
  replaceAt(113, ' {hien_trang_so}'),
  replaceAt(114, ''),
  replaceAt(115, ''),
  replaceAt(128, '{ho_ten_nguoi_giao}'),
  replaceAt(131, '{ho_ten_nguoi_nhan}'),
  replaceAt(132, ''),
  replaceAt(133, '')
]);

let textIndex = 0;
xml = xml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (match, attrs) => {
  const value = replacements.get(textIndex);
  textIndex += 1;
  return value === undefined ? match : `<w:t${attrs}>${escapeXml(value)}</w:t>`;
});

zip.file('word/document.xml', xml);
fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Da tao lai ${outputPath}`);
