const fs = require('fs');
const path = require('path');

const documentPath = process.argv[2];

if (!documentPath) {
  throw new Error('Thiếu đường dẫn document.xml.');
}

let xml = fs.readFileSync(documentPath, 'utf8');

function replaceStrict(search, replace) {
  if (!xml.includes(search)) {
    throw new Error(`Không tìm thấy đoạn cần thay trong template: ${search}`);
  }
  xml = xml.replace(search, replace);
}

function replaceRegexStrict(pattern, replace) {
  const nextXml = xml.replace(pattern, replace);
  if (nextXml === xml) {
    throw new Error(`Không tìm thấy đoạn cần thay theo regex: ${pattern}`);
  }
  xml = nextXml;
}

const dateMarker =
  '…/</w:t></w:r><w:proofErr w:type="gramStart"/><w:r w:rsidRPr="000E6152"><w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>…./</w:t></w:r><w:proofErr w:type="gramEnd"/><w:r w:rsidRPr="000E6152"><w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>…</w:t></w:r><w:r w:rsidR="006F38CD" w:rsidRPr="000E6152"><w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>….,';

replaceRegexStrict(
  /001094004597<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>\/202<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>5<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>\/HĐ<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>ĐC/g,
  '{so_hop_dong}'
);
replaceStrict(dateMarker, '{ngay_ky}/{thang_ky}/{nam_ky},');
replaceStrict('Công ty CP vận tải Hoàng Minh Dũng - CN Vĩnh Phúc', '{ten_don_vi}');
replaceStrict('CÔNG TY CPVT HOÀNG MINH DŨNG – CHI NHÁNH VĨNH PHÚC', '{ten_don_vi}');
replaceRegexStrict(
  /Tổ 01, <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>Phường Phúc Yên, Tỉnh Phú Thọ/g,
  '{dia_chi_don_vi}'
);
replaceStrict('0104163591-001', '{ma_so_thue_don_vi}');
replaceRegexStrict(
  /Ông <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>Nguyễn Trường Xuân<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t xml:space="preserve">\s*Chức danh: <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>Giám đốc/g,
  'Ông {nguoi_dai_dien_don_vi} Chức danh: {chuc_vu_nguoi_dai_dien}'
);
replaceRegexStrict(
  /Ông\/Bà <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>Nguyễn Văn ABC/g,
  'Ông/Bà {ho_ten_lai_xe}'
);
replaceStrict('Số nhà 15, ngõ 2, Đường 3, Dược Thượng, xã Sóc Sơn, Thành phố Hà Nội', '{dia_chi_day_du}');
replaceStrict('001094004597', '{so_cccd}');
replaceRegexStrict(
  /Ngày cấp:<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t xml:space="preserve"> 01\/01\/2020/g,
  'Ngày cấp: {ngay_cap_cccd}'
);
replaceRegexStrict(
  /Nơi cấp: <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>CCS QLHC về TTXH/g,
  'Nơi cấp: {noi_cap_cccd}'
);
replaceRegexStrict(
  /Số tiền đặt cọc: 10\.000\.000 đồng<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t xml:space="preserve"> <\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>\(Bằng chữ: Mười triệu đồng\)\./g,
  'Số tiền đặt cọc: {so_tien_phai_nop} đồng (Bằng chữ: {so_tien_phai_nop_text} đồng).'
);
replaceStrict('Hợp đồng có hiệu lực từ ngày 06/11/2025 đến hết ngày 05/11/2026.', 'Hợp đồng có hiệu lực kể từ ngày ký.');

fs.writeFileSync(documentPath, xml, 'utf8');
console.log(`Đã cập nhật ${path.resolve(documentPath)}`);
