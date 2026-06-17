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
  '.ps1',
  '.txt'
]);

const mojibakePatterns = [
  { name: 'Ký tự thay thế Unicode', pattern: /\uFFFD/ },
  { name: 'Chuỗi replacement bị encode sai', pattern: /\u00EF\u00BF\u00BD/ },
  { name: 'Tiếng Việt UTF-8 bị đọc sai dạng dấu tiếng Việt', pattern: new RegExp('(?:\\u00E1\\u00BA|\\u00E1\\u00BB|\\u00C3[\\u00A0-\\u00BF]|\\u00C4[\\u0080-\\u00BF\\u2018-\\u201D]|\\u00C6[\\u0080-\\u00BF\\u2018-\\u201D]|\\u00E2[\\u0080-\\u00BF\\u20AC\\u2018-\\u201D])') },
  { name: 'Tiếng Việt bị thay bằng dấu hỏi', pattern: /\b(?:Kh\?ng|Thi\?u|d\? li\?u|t\?i|b\?ng|c\?t|kh\?a|hi\?n th\?|nghi\?p v\?|C\?n ki\?m tra|H\?p)\b/i }
];

function shouldCheckFile(filePath) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);

  if (basename === '.env') return false;
  if (basename === '.env.example') return true;
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
