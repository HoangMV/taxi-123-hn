const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourceName = 'de_nghi_cap_phu_hieu_xe_template.docx';

if (!fs.existsSync(path.join(publicDir, sourceName))) {
  throw new Error('Không tìm thấy file .docx gốc của mẫu đơn đề nghị cấp phù hiệu xe trong thư mục public.');
}

const sourcePath = path.join(publicDir, sourceName);
const zip = new PizZip(fs.readFileSync(sourcePath));
let documentXml = zip.file('word/document.xml')?.asText();

if (!documentXml) {
  throw new Error('Không đọc được word/document.xml trong file gốc.');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceFirstTextNodeValue(xml, needle, replacement) {
  const replacementTokenMatch = String(replacement).match(/\{[^}]+\}/);
  if (xml.includes(escapeXml(replacement)) || (replacementTokenMatch && xml.includes(replacementTokenMatch[0]))) {
    return xml;
  }

  let replaced = false;

  const nextXml = xml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (match, attrs, text) => {
    if (replaced || text !== needle) {
      return match;
    }

    replaced = true;
    const decoded = String(replacement);
    const needsPreserve = /^\s|\s$/.test(decoded);
    const nextAttrs = needsPreserve && !attrs.includes('xml:space')
      ? `${attrs} xml:space="preserve"`
      : attrs.replace(/\s+xml:space="preserve"/g, '');

    return `<w:t${nextAttrs}>${escapeXml(decoded)}</w:t>`;
  });

  if (!replaced) {
    throw new Error(`Không tìm thấy text node "${needle}" trong file gốc.`);
  }

  return nextXml;
}

function buildRun(text, options = {}) {
  const size = options.size || 20;
  const bold = options.bold || false;
  const italic = options.italic || false;
  const preserve = /^\s|\s$/.test(text);

  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${bold ? '<w:b/><w:bCs/>' : ''}${italic ? '<w:i/><w:iCs/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t${preserve ? ' xml:space="preserve"' : ''}>${escapeXml(text)}</w:t></w:r>`;
}

function replaceParagraphContent(xml, predicate, runs) {
  const joinedText = runs.map((run) => run.text).join('');
  const placeholderTokens = runs
    .flatMap((run) => String(run.text).match(/\{[^}]+\}/g) || [])
    .filter(Boolean);

  if (
    xml.includes(escapeXml(joinedText)) ||
    (placeholderTokens.length > 0 && placeholderTokens.every((token) => xml.includes(token)))
  ) {
    return xml;
  }

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];

  for (const match of paragraphs) {
    const paragraphXml = match[0];
    const paragraphText = [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((textMatch) => textMatch[1])
      .join('');

    if (!predicate(paragraphText)) {
      continue;
    }

    const pStart = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
    const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
    const nextParagraphXml = `${pStart}${pPr}${runs.map((run) => buildRun(run.text, run)).join('')}</w:p>`;
    return xml.replace(paragraphXml, nextParagraphXml);
  }

  throw new Error('Không tìm thấy đoạn văn cần thay trong file gốc.');
}

function replaceHeaderMetaRow(xml) {
  const firstTableMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!firstTableMatch) {
    throw new Error('Không tìm thấy bảng tiêu đề đầu trang trong file gốc.');
  }

  const firstTableXml = firstTableMatch[0];
  const rows = [...firstTableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
  if (rows.length < 2) {
    throw new Error('Bảng tiêu đề đầu trang không có đủ 2 dòng.');
  }

  const replacementRow = [
    '<w:tr w:rsidR="006A5FBE" w:rsidRPr="000D07A8" w14:paraId="5A0A9C4E" w14:textId="77777777" w:rsidTr="007D5717">',
    '<w:tc><w:tcPr><w:tcW w:w="3348" w:type="dxa"/></w:tcPr>',
    '<w:p w14:paraId="38557328" w14:textId="77777777" w:rsidR="006A5FBE" w:rsidRPr="000D07A8" w:rsidRDefault="006A5FBE" w:rsidP="007D5717">',
    '<w:pPr><w:spacing w:before="120"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>',
    buildRun('Số: {so_ho_so}', { size: 28 }),
    '</w:p></w:tc>',
    '<w:tc><w:tcPr><w:tcW w:w="5508" w:type="dxa"/></w:tcPr>',
    '<w:p w14:paraId="412F98ED" w14:textId="50908F50" w:rsidR="006A5FBE" w:rsidRPr="000D07A8" w:rsidRDefault="000D07A8" w:rsidP="000D07A8">',
    '<w:pPr><w:spacing w:before="120"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>',
    buildRun('{dia_danh_lap_don}', { size: 28, italic: true }),
    buildRun(', ngày {ngay_lap_day} tháng {ngay_lap_month} năm {ngay_lap_year}', { size: 28, italic: true }),
    '</w:p></w:tc></w:tr>'
  ].join('');

  const nextTableXml = firstTableXml.replace(rows[1], replacementRow);
  return xml.replace(firstTableXml, nextTableXml);
}

function replaceCellParagraphText(cellXml, text, options = {}) {
  const paragraphMatch = cellXml.match(/<w:p\b[\s\S]*?<\/w:p>/);
  if (!paragraphMatch) {
    return cellXml;
  }

  const paragraphXml = paragraphMatch[0];
  const pStart = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
  const runXml = buildRun(text, options);
  const nextParagraphXml = `${pStart}${pPr}${runXml}</w:p>`;

  return cellXml.replace(paragraphXml, nextParagraphXml);
}

function replaceVehicleTable(xml) {
  const tables = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  const tableXml = tables[1];

  if (!tableXml) {
    throw new Error('Không tìm thấy bảng danh sách xe trong file gốc.');
  }

  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
  if (rows.length < 2) {
    throw new Error('Bảng danh sách xe không có đủ dòng để tạo loop.');
  }

  const headerRow = rows[0];
  const sampleRow = rows[1];
  const sampleCells = [...sampleRow.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);

  if (sampleCells.length !== 8) {
    throw new Error(`Dòng mẫu của bảng xe có ${sampleCells.length} ô, không đúng kỳ vọng 8 ô.`);
  }

  const rowStart = sampleRow.match(/^<w:tr\b[^>]*>/)?.[0];
  if (!rowStart) {
    throw new Error('Không đọc được thẻ mở của dòng mẫu trong bảng xe.');
  }

  const loopCells = [
    replaceCellParagraphText(sampleCells[0], '{#danh_sach_xe}{stt}'),
    replaceCellParagraphText(sampleCells[1], '{bien_so}'),
    replaceCellParagraphText(sampleCells[2], '{suc_chua}'),
    replaceCellParagraphText(sampleCells[3], '{nhan_hieu}'),
    replaceCellParagraphText(sampleCells[4], '{nuoc_san_xuat}'),
    replaceCellParagraphText(sampleCells[5], '{nam_san_xuat}'),
    replaceCellParagraphText(sampleCells[6], '{loai_phu_hieu}'),
    replaceCellParagraphText(sampleCells[7], '{phuong_thuc_tinh_tien}{/danh_sach_xe}')
  ];

  const loopRowXml = `${rowStart}${loopCells.join('')}</w:tr>`;
  const nextTableXml = tableXml.replace(rows.slice(1).join(''), loopRowXml);

  return xml.replace(tableXml, nextTableXml);
}

documentXml = replaceFirstTextNodeValue(documentXml, ' .........', ' {ten_don_vi_upper}');
documentXml = replaceHeaderMetaRow(documentXml);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('Kính gửi:'), [
  { text: 'Kính gửi: {ten_co_quan_cap}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('1. Tên đơn vị kinh doanh vận tải:'), [
  { text: '1. Tên đơn vị kinh doanh vận tải: {ten_don_vi}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('2. Địa chỉ:'), [
  { text: '2. Địa chỉ: {dia_chi_don_vi}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('3. Số điện thoại (Fax):'), [
  { text: '3. Số điện thoại (Fax): {so_dien_thoai}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('Số lượng phù hiệu nộp lại:'), [
  { text: 'Số lượng phù hiệu nộp lại: {so_luong_nop_lai}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text.startsWith('Đề nghị được cấp:'), [
  { text: 'Đề nghị được cấp: {so_luong_de_nghi_cap}', size: 28 }
]);

documentXml = replaceParagraphContent(documentXml, (text) => text === 'Nguyễn Văn A', [
  { text: '{nguoi_dai_dien_don_vi_upper}', size: 28, bold: true }
]);

documentXml = replaceVehicleTable(documentXml);

zip.file('word/document.xml', documentXml);
fs.writeFileSync(sourcePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Đã cập nhật trực tiếp file gốc: ${sourcePath}`);
