const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const publicDir = path.join(__dirname, '..', 'public');
const sourceName = fs.readdirSync(publicDir).find((name) => {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized.endsWith('.docx') && normalized.includes('3025') && normalized.includes('thoa thuan dan su');
});

if (!sourceName) {
  throw new Error('Không tìm thấy file DOCX mẫu gốc thỏa thuận dân sự trong thư mục public.');
}

const sourcePath = path.join(publicDir, sourceName);
const outputPath = path.join(publicDir, 'thoa_thuan_dan_su_lai_xe_template.docx');

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceTextNodes(xml, replacements) {
  let index = 0;
  return xml.replace(/(<w:t(?: [^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (match, open, text, close) => {
    const replacement = Object.prototype.hasOwnProperty.call(replacements, index) ? replacements[index] : null;
    index += 1;
    if (replacement === null) return match;
    return `${open}${xmlEscape(replacement)}${close}`;
  });
}

const zip = new PizZip(fs.readFileSync(sourcePath));
const documentFile = zip.file('word/document.xml');
if (!documentFile) {
  throw new Error('File DOCX mẫu không có word/document.xml.');
}

const originalXml = documentFile.asText();
const nodeCount = [...originalXml.matchAll(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/g)].length;
if (nodeCount < 555) {
  throw new Error(`Cấu trúc DOCX mẫu đã thay đổi, chỉ có ${nodeCount} text node. Cần kiểm tra lại mapping template.`);
}

const replacements = {
  0: '{ten_don_vi_upper}',
  10: '{dia_diem_ky}',
  13: '{ngay_ky}',
  15: '{thang_ky}',
  16: '',
  17: ' năm {nam_ky}',
  21: '{so_thoa_thuan}',
  24: '{bien_so_xe}',
  31: '{ma_dam}',
  32: '',
  42: 'Công ty {ten_don_vi}',
  43: '',
  44: '',
  58: '{ngay_ky}',
  61: '{thang_ky}',
  62: '',
  65: '{nam_ky}',
  67: 'Tại văn phòng {ten_don_vi}; Địa chỉ: {dia_chi_don_vi}.',
  68: '',
  69: '',
  70: '',
  71: '',
  72: '',
  73: '',
  74: '',
  75: '',
  76: '',
  77: '',
  78: '',
  79: '',
  80: '',
  81: '',
  82: '',
  83: '',
  84: '',
  85: '',
  86: '',
  87: '',
  88: '',
  89: 'BÊN A: {ten_don_vi_upper}',
  90: '',
  91: '',
  92: 'Địa chỉ: {dia_chi_don_vi}',
  93: '',
  94: '',
  95: '',
  96: '',
  97: 'Điện thoại: {dien_thoai_don_vi}',
  99: '{dai_dien_ben_a}',
  103: '{chuc_vu_ben_a}',
  104: 'BÊN B: {ho_ten_lai_xe_upper}',
  107: '{dia_chi_lai_xe}',
  108: '',
  111: '{ngay_sinh_lai_xe}',
  114: '{so_cccd}',
  121: '{ngay_cap_cccd}',
  122: '',
  127: '{noi_cap_cccd}',
  130: '{so_gplx}',
  139: '{ngay_cap_gplx}',
  142: '{so_dien_thoai_lai_xe}',
  171: '{nhan_hieu_xe}',
  174: '{bien_so_xe}',
  177: '{so_khung}',
  180: '{so_may}',
  183: '{nam_san_xuat}',
  184: '',
  187: '{mau_son}',
  189: '{ngay_dang_ky_lan_dau}',
  222: '{hinh_thuc_khoan}',
  223: '',
  224: '',
  231: '{so_tien_dat_coc}',
  233: ' {so_tien_dat_coc_bang_chu}',
  271: '{ty_le_phat_cham_nop_ngay}',
  272: ' trên số tiền chậm ',
  297: '{hinh_thuc_thanh_toan}.',
  542: '{ngay_hieu_luc_text}',
  546: '{ngay_het_han_text}',
  552: '{dai_dien_ben_a}',
  554: '{ho_ten_lai_xe}'
};

const nextXml = replaceTextNodes(originalXml, replacements)
  .replace(/<w:instrText(?: [^>]*)?>[\s\S]*?<\/w:instrText>/gi, '')
  .replace(/<w:fldChar\b[^>]*\/>/gi, '')
  .replace(/<w:fldChar\b[\s\S]*?<\/w:fldChar>/gi, '');
zip.file('word/document.xml', nextXml);

fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer' }));

const placeholders = [...nextXml.matchAll(/\{[a-z0-9_]+\}/g)].map((match) => match[0]);
console.log(`Đã tạo ${path.relative(process.cwd(), outputPath)} từ ${sourceName}.`);
console.log(`Số placeholder: ${placeholders.length}.`);
