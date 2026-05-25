const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const ignoredDirs = new Set([
  '.git',
  'build',
  'dist',
  'node_modules'
]);

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.txt'
]);

const mojibakePatterns = [
  { name: 'Ký tự thay thế Unicode', pattern: /\uFFFD/ },
  { name: 'Chuỗi lỗi dạng replacement bị encode sai', pattern: /\u00EF\u00BF\u00BD/ },
  { name: 'Tiếng Việt UTF-8 bị đọc sai dạng a sắc/hỏi/ngã/nặng', pattern: /\u00E1[\u00BB\u00BA]/ },
  { name: 'Tiếng Việt UTF-8 bị đọc sai dạng D gạch ngang', pattern: /\u00C4[\u0080-\u00BF‘’“”a-zA-Z]/ },
  { name: 'Tiếng Việt UTF-8 bị đọc sai dạng u/o móc', pattern: /\u00C6[\u0080-\u00BF‘’“”a-zA-Z]/ },
  { name: 'Tiếng Việt UTF-8 bị đọc sai dạng A ngã + byte Latin-1', pattern: /\u00C3[\u0080-\u00BF\u00A1-\u00BF]/ },
  { name: 'Tiếng Việt bị thay bằng dấu hỏi', pattern: /\b(L\?\?c|d\? li\?u|S\? d\?ng|T\?i li\?u|Quan h\?|b\?ng|c\?t|kh\?a|hi\?n th\?|nghi\?p v\?|C\?n ki\?m tra)\b/i }
];

function shouldCheckFile(filePath) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);

  if (basename === '.env' || basename === '.env.example') return true;
  return textExtensions.has(extension);
}

function walk(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dirPath, entry.name), files);
      }
      continue;
    }

    if (entry.isFile()) {
      const filePath = path.join(dirPath, entry.name);
      if (shouldCheckFile(filePath)) {
        files.push(filePath);
      }
    }
  }

  return files;
}

function getLineInfo(content, index) {
  const before = content.slice(0, index);
  const lineNumber = before.split(/\r?\n/).length;
  const lineStart = content.lastIndexOf('\n', index) + 1;
  const lineEnd = content.indexOf('\n', index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim();
  return { lineNumber, line };
}

const problems = [];

for (const filePath of walk(rootDir)) {
  const content = fs.readFileSync(filePath, 'utf8');

  for (const check of mojibakePatterns) {
    const match = check.pattern.exec(content);
    if (!match) continue;

    const lineInfo = getLineInfo(content, match.index);
    problems.push({
      filePath: path.relative(rootDir, filePath),
      checkName: check.name,
      ...lineInfo
    });
    break;
  }
}

if (problems.length > 0) {
  console.error('Phát hiện nội dung có dấu hiệu lỗi mã hóa tiếng Việt:\n');
  problems.forEach((problem) => {
    console.error(`- ${problem.filePath}:${problem.lineNumber} - ${problem.checkName}`);
    console.error(`  ${problem.line}`);
  });
  process.exitCode = 1;
} else {
  console.log('Không phát hiện lỗi mã hóa tiếng Việt.');
}
