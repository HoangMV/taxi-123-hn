const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const TEMPLATE_SOURCES = [
  {
    sourceIncludes: ['CV ', 'Hà Nội', '.docx'],
    outputName: 'thong_bao_ngung_phu_hieu_ha_noi_template.docx',
    replacements: [
      ['Số: ......../2026/CV-SXD', 'Số: {so_thong_bao}'],
      ['ngày .... tháng .... năm', '                {dia_danh_lap_thong_bao}, ngày {ngay_thong_bao_day} tháng {ngay_thong_bao_month} năm {ngay_thong_bao_year}'],
      ['Kính gửi: Sở Xây dựng TP Hà Nội', 'Kính gửi: {co_quan_nhan_thong_bao}'],
      ['Tên doanh nghiệp vận tải: Công ty cổ phần vận tải Hoàng Minh Dũng ', 'Tên doanh nghiệp vận tải: {ten_don_vi}'],
      ['Địa chỉ trụ sở doanh nghiệp: Số 96 - Khu III – Đường QL 2 – Nội Bài – Hà Nội. ', 'Địa chỉ trụ sở doanh nghiệp: {dia_chi_don_vi}'],
      ['Số điện thoại: 0243.88.66.900', 'Số điện thoại: {so_dien_thoai}'],
      ['5. Số lượng xe xin tạm ngừng kinh doanh taxi: 01 xe, danh sách xe như sau:', '5. Số lượng xe xin tạm ngừng kinh doanh taxi: {so_luong_xe} xe, danh sách xe như sau:'],
      ['- Số lượng phù hiệu nộp lại: 01 phù hiệu.', '- Số lượng phù hiệu nộp lại: {so_luong_phu_hieu_nop_lai} phù hiệu.'],
      ['6. Hiện nay Công ty Cổ phần vận tải Hoàng Minh Dũng thu hồi 01 phù hiệu “Xe taxi” nộp lại Sở giao thông và xin bảo lưu số phù hiệu trên chờ thay thế.', '6. Hiện nay {ten_don_vi} thu hồi {so_luong_phu_hieu_nop_lai} phù hiệu “{loai_phu_hieu}” nộp lại Sở giao thông và xin bảo lưu số phù hiệu trên chờ thay thế.']
    ],
    tableReplacements: [
      ['30E-241.00', '{bien_so}'],
      ['TX2525001226', '{so_phu_hieu}'],
      ['03/08/2027', '{han_phu_hieu}'],
      ['CT CPVT Hoàng Minh Dũng', '{don_vi}']
    ]
  },
  {
    sourceIncludes: ['CV ', 'Vĩnh Phúc', '.docx'],
    outputName: 'thong_bao_ngung_phu_hieu_vinh_phuc_template.docx',
    replacements: [
      ['Số: ......../2026/CV-SXD', 'Số: {so_thong_bao}'],
      ['ngày .... tháng .... năm', '                {dia_danh_lap_thong_bao}, ngày {ngay_thong_bao_day} tháng {ngay_thong_bao_month} năm {ngay_thong_bao_year}'],
      ['Kính gửi: Sở Xây dựng tỉnh Phú Thọ', 'Kính gửi: {co_quan_nhan_thong_bao}'],
      ['Tên doanh nghiệp vận tải: Công ty cổ phần vận tải Hoàng Minh Dũng – Chi nhánh Vĩnh Phúc', 'Tên doanh nghiệp vận tải: {ten_don_vi}'],
      ['Địa chỉ trụ sở doanh nghiệp: Tổ 1, Phường Phúc Yên, Tỉnh Phú Thọ', 'Địa chỉ trụ sở doanh nghiệp: {dia_chi_don_vi}'],
      ['Số điện thoại: 0916.658.123', 'Số điện thoại: {so_dien_thoai}'],
      ['5. Số lượng xe đề nghị hủy phù hiệu: 01 xe, danh sách xe như sau:', '5. Số lượng xe đề nghị hủy phù hiệu: {so_luong_xe} xe, danh sách xe như sau:'],
      ['- Số lượng phù hiệu, biển hiệu nộp lại: 01 phù hiệu.', '- Số lượng phù hiệu, biển hiệu nộp lại: {so_luong_phu_hieu_nop_lai} phù hiệu.']
    ],
    tableReplacements: [
      ['30E-241.00', '{bien_so}'],
      ['TX2525001226', '{so_phu_hieu}'],
      ['03/08/2027', '{han_phu_hieu}'],
      ['CT CPVT Hoàng Minh Dũng- CNVP', '{don_vi}']
    ]
  }
];

function findSourceFile(sourceIncludes) {
  const files = fs.readdirSync(publicDir);
  const found = files.find((fileName) => sourceIncludes.every((part) => fileName.includes(part)));
  if (!found) {
    throw new Error(`Không tìm thấy file mẫu có các đoạn tên: ${sourceIncludes.join(', ')}`);
  }
  return path.join(publicDir, found);
}

function replaceText(xml, search, replacement) {
  const escapedSearch = escapeXml(search);
  const escapedReplacement = escapeXml(replacement);
  if (xml.includes(escapedSearch)) {
    return xml.replace(escapedSearch, escapedReplacement);
  }

  return replaceParagraphContent(xml, (text) => text.includes(search), replacement);
}

function replaceFirstText(xml, search, replacement) {
  const escapedSearch = escapeXml(search);
  const escapedReplacement = escapeXml(replacement);
  const index = xml.indexOf(escapedSearch);
  if (index === -1) {
    throw new Error(`Không tìm thấy nội dung cần thay: ${search}`);
  }
  return `${xml.slice(0, index)}${escapedReplacement}${xml.slice(index + escapedSearch.length)}`;
}

function replaceFirstTextNodeValue(xml, search, replacement) {
  const escapedSearch = escapeXml(search);
  const escapedReplacement = escapeXml(replacement);
  let replaced = false;

  const nextXml = xml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (match, attrs, text) => {
    if (replaced || text !== escapedSearch) {
      return match;
    }

    replaced = true;
    return `<w:t${attrs}>${escapedReplacement}</w:t>`;
  });

  if (!replaced) {
    throw new Error(`Không tìm thấy text node cần thay: ${search}`);
  }

  return nextXml;
}

function buildRun(text) {
  const preserve = /^\s|\s$/.test(text);
  return [
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    '<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>',
    `<w:t${preserve ? ' xml:space="preserve"' : ''}>${escapeXml(text)}</w:t></w:r>`
  ].join('');
}

function getParagraphText(paragraphXml) {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function replaceParagraphContent(xml, predicate, replacement) {
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];

  for (const match of paragraphs) {
    const paragraphXml = match[0];
    const paragraphText = getParagraphText(paragraphXml);

    if (!predicate(paragraphText)) continue;

    const pStart = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
    const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
    const nextParagraphXml = `${pStart}${pPr}${buildRun(replacement)}</w:p>`;
    return xml.replace(paragraphXml, nextParagraphXml);
  }

  throw new Error(`Không tìm thấy đoạn văn cần thay: ${replacement}`);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceCellParagraphText(cellXml, text) {
  const paragraphMatch = cellXml.match(/<w:p\b[\s\S]*?<\/w:p>/);
  if (!paragraphMatch) return cellXml;

  const paragraphXml = paragraphMatch[0];
  const pStart = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
  const pPr = paragraphXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '<w:pPr/>';
  const nextParagraphXml = `${pStart}${pPr}${buildRun(text)}</w:p>`;
  return cellXml.replace(paragraphXml, nextParagraphXml);
}

function addVehicleLoop(xml) {
  const tables = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  const tableXml = tables[1];
  if (!tableXml) {
    throw new Error('Không tìm thấy bảng danh sách xe trong file mẫu.');
  }

  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
  if (rows.length < 2) {
    throw new Error('Bảng danh sách xe không có dòng dữ liệu mẫu.');
  }

  const sampleRow = rows[1];
  const sampleCells = [...sampleRow.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);
  if (sampleCells.length !== 6) {
    throw new Error(`Dòng dữ liệu mẫu có ${sampleCells.length} ô, không đúng kỳ vọng 6 ô.`);
  }

  const rowStart = sampleRow.match(/^<w:tr\b[^>]*>/)?.[0];
  if (!rowStart) {
    throw new Error('Không đọc được thẻ mở của dòng dữ liệu mẫu.');
  }

  const loopCells = [
    replaceCellParagraphText(sampleCells[0], '{#danh_sach_xe}{stt}'),
    replaceCellParagraphText(sampleCells[1], '{bien_so}'),
    replaceCellParagraphText(sampleCells[2], '{so_phu_hieu}'),
    replaceCellParagraphText(sampleCells[3], '{han_phu_hieu}'),
    replaceCellParagraphText(sampleCells[4], '{don_vi}'),
    replaceCellParagraphText(sampleCells[5], '{ly_do}{/danh_sach_xe}')
  ];

  const loopRowXml = `${rowStart}${loopCells.join('')}</w:tr>`;
  const nextTableXml = tableXml.replace(sampleRow, loopRowXml);
  return xml.replace(tableXml, nextTableXml);
}

function buildTemplate(config) {
  const sourcePath = findSourceFile(config.sourceIncludes);
  const zip = new PizZip(fs.readFileSync(sourcePath));
  let documentXml = zip.file('word/document.xml')?.asText();

  if (!documentXml) {
    throw new Error(`Không đọc được word/document.xml trong ${sourcePath}`);
  }

  config.replacements.forEach(([search, replacement]) => {
    documentXml = replaceText(documentXml, search, replacement);
  });
  documentXml = addVehicleLoop(documentXml);

  zip.file('word/document.xml', documentXml);
  const outputPath = path.join(publicDir, config.outputName);
  fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Đã tạo ${outputPath}`);
}

TEMPLATE_SOURCES.forEach(buildTemplate);
