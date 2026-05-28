const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const templatePath = path.join(repoRoot, 'public', 'ky_quy_lai_xe_template.docx');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ky-quy-template-'));
const sourceZipPath = path.join(tempRoot, 'source.zip');
const extractDir = path.join(tempRoot, 'unzipped');
const repackedZipPath = path.join(tempRoot, 'repacked.zip');

const brokenLine = 'H?p ??ng c? hi?u l?c t? ng?y {ngay_hieu_luc_text} ??n h?t ng?y {ngay_het_han_text}';
const correctLine = 'Hợp đồng có hiệu lực từ ngày {ngay_hieu_luc_text} đến hết ngày {ngay_het_han_text}';

function runPowerShell(command) {
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { stdio: 'inherit' }
  );
}

try {
  fs.copyFileSync(templatePath, sourceZipPath);
  fs.mkdirSync(extractDir, { recursive: true });

  runPowerShell(`Expand-Archive -LiteralPath '${sourceZipPath}' -DestinationPath '${extractDir}' -Force`);

  const documentXmlPath = path.join(extractDir, 'word', 'document.xml');
  let xml = fs.readFileSync(documentXmlPath, 'utf8');

  if (xml.includes(brokenLine)) {
    xml = xml.replace(brokenLine, correctLine);
  }

  xml = xml.replace(
    /Hợp đồng có hiệu lực từ ngày [^<]*?\{ngay_hieu_luc_text\}[^<]*?\{ngay_het_han_text\}[^<]*?/g,
    correctLine
  );

  fs.writeFileSync(documentXmlPath, xml, 'utf8');

  if (fs.existsSync(repackedZipPath)) {
    fs.unlinkSync(repackedZipPath);
  }

  runPowerShell(`Compress-Archive -Path '${path.join(extractDir, '*')}' -DestinationPath '${repackedZipPath}' -Force`);
  fs.copyFileSync(repackedZipPath, templatePath);

  console.log(`Đã sửa template UTF-8: ${templatePath}`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
