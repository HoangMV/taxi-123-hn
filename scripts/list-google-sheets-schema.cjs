const fs = require('fs');
const path = require('path');
const { readGoogleSheetTables } = require('./google-sheets-service.cjs');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  });
  return result;
}

const TABLE_DEPENDENCIES = {
  NHANSU_KYQUY: ['DONVI', 'NHANSU']
};

function parseArgs(argv) {
  const options = {
    format: 'markdown',
    tables: [],
    output: '',
    sampleSize: 100
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length).trim().toLowerCase();
      return;
    }

    if (arg.startsWith('--tables=')) {
      options.tables.push(...splitTableNames(arg.slice('--tables='.length)));
      return;
    }

    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length).trim();
      return;
    }

    if (arg.startsWith('--sample-size=')) {
      const value = Number(arg.slice('--sample-size='.length));
      if (Number.isInteger(value) && value > 0) {
        options.sampleSize = value;
      }
      return;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return;
    }

    options.tables.push(...splitTableNames(arg));
  });

  options.tables = expandTablesWithDependencies(options.tables);
  return options;
}

function splitTableNames(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandTablesWithDependencies(tableNames) {
  const ordered = [];
  const visited = new Set();

  function visit(tableName) {
    const normalizedName = String(tableName || '').trim();
    if (!normalizedName || visited.has(normalizedName)) return;
    visited.add(normalizedName);

    const dependencies = TABLE_DEPENDENCIES[normalizedName] || [];
    dependencies.forEach(visit);
    ordered.push(normalizedName);
  }

  tableNames.forEach(visit);
  return ordered;
}

function printHelp() {
  console.log(`Cách dùng:
  npm run schema:google-sheets
  npm run schema:google-sheets -- --tables=PHUHIEUXE,ThongTin
  npm run schema:google-sheets -- PHUHIEUXE ThongTin --format=json
  npm run schema:google-sheets -- --output=docs/google-sheets-schema.md

Tùy chọn:
  --tables=...        Danh sách bảng, phân tách bằng dấu phẩy.
  --format=markdown   Định dạng xuất ra: markdown hoặc json. Mặc định là markdown.
  --output=...        Ghi kết quả ra file thay vì chỉ in ra terminal.
  --sample-size=100   Số dòng mẫu dùng để suy luận kiểu dữ liệu sau khi tải bảng.
`);
}

function inferValueType(value) {
  if (value === null || value === undefined || value === '') return 'Trống';
  if (Array.isArray(value)) return 'Danh sách';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'Số nguyên' : 'Số thập phân';
  if (typeof value === 'object') return 'Đối tượng';

  const text = String(value).trim();
  if (!text) return 'Trống';
  if (/^(true|false)$/i.test(text)) return 'Boolean';
  if (/^-?\d+$/.test(text)) return 'Số nguyên';
  if (/^-?\d+([.,]\d+)?$/.test(text)) return 'Số thập phân';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return 'Giờ';
  if (/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2})?)?/.test(text)) {
    return text.includes('T') || /\s\d{2}:\d{2}/.test(text) ? 'Ngày giờ' : 'Ngày';
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) return 'Ngày';
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? 'Danh sách' : 'Đối tượng';
    } catch {
      return 'Văn bản';
    }
  }

  return 'Văn bản';
}

function mergeTypes(types) {
  const meaningfulTypes = [...types].filter((type) => type !== 'Trống');
  if (meaningfulTypes.length === 0) return 'Trống';
  const uniqueTypes = [...new Set(meaningfulTypes)];
  if (uniqueTypes.length === 1) return uniqueTypes[0];
  if (uniqueTypes.every((type) => type === 'Số nguyên' || type === 'Số thập phân')) return 'Số thập phân';
  if (uniqueTypes.every((type) => type === 'Ngày' || type === 'Ngày giờ')) return 'Ngày giờ';
  return uniqueTypes.join(' hoặc ');
}

function inferColumns(rows, sampleSize) {
  const sampleRows = rows.slice(0, sampleSize);
  const columns = new Map();

  sampleRows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    Object.entries(row).forEach(([name, value]) => {
      if (!columns.has(name)) {
        columns.set(name, {
          name,
          types: [],
          nonEmptyCount: 0
        });
      }

      const column = columns.get(name);
      const type = inferValueType(value);
      column.types.push(type);
      if (type !== 'Trống') {
        column.nonEmptyCount += 1;
      }
    });
  });

  return [...columns.values()].map((column) => ({
    name: column.name,
    type: mergeTypes(column.types),
    nonEmptyCount: column.nonEmptyCount
  }));
}

function renderMarkdown(schema, sampleSize) {
  const lines = [
    '# Lược đồ dữ liệu Google Sheets',
    '',
    `Số dòng mẫu dùng để suy luận kiểu dữ liệu: ${sampleSize}.`,
    ''
  ];

  schema.forEach((table) => {
    lines.push(`## ${table.name}`);
    if (table.error) {
      lines.push('');
      lines.push(`Không đọc được bảng: ${table.error}`);
      lines.push('');
      return;
    }

    lines.push('');
    lines.push(`Số dòng tải được: ${table.rowCount}.`);
    lines.push('');
    lines.push('| Cột | Kiểu dữ liệu suy luận | Số dòng có dữ liệu trong mẫu |');
    lines.push('| --- | --- | ---: |');

    table.columns.forEach((column) => {
      lines.push(`| ${escapeMarkdown(column.name)} | ${escapeMarkdown(column.type)} | ${column.nonEmptyCount} |`);
    });

    if (table.columns.length === 0) {
      lines.push('| Chưa có dữ liệu mẫu | Trống | 0 |');
    }

    lines.push('');
  });

  lines.push('Ghi chú: Kiểu dữ liệu ở đây được suy luận từ dữ liệu bảng. File này chỉ liệt kê tên cột/kiểu dữ liệu; quan hệ Ref phải xem thêm `docs/google-sheets-relationships.md`.');
  return `${lines.join('\n')}\n`;
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.format !== 'markdown' && options.format !== 'json') {
    throw new Error('Định dạng chỉ hỗ trợ markdown hoặc json.');
  }

  const env = { ...parseEnvFile(envPath), ...process.env };
  const envTables = expandTablesWithDependencies(
    splitTableNames(env.REACT_APP_SCHEMA_TABLES || env.REACT_APP_DEFAULT_TABLE || '')
  );
  const tables = options.tables.length > 0 ? options.tables : envTables;


  if (tables.length === 0) {
    throw new Error('Chưa có tên bảng. Hãy truyền --tables=TenBang1,TenBang2 hoặc khai báo REACT_APP_SCHEMA_TABLES trong .env.');
  }

  const schema = [];
  for (const [index, tableName] of tables.entries()) {
    process.stderr.write(`Đang đọc bảng ${tableName}...\n`);
    try {
      const tableRows = await readGoogleSheetTables([tableName], env);
      const rows = tableRows[tableName] || [];
      const safeRows = Array.isArray(rows) ? rows : [];
      schema.push({
        name: tableName,
        rowCount: safeRows.length,
        columns: inferColumns(safeRows, options.sampleSize)
      });
    } catch (error) {
      schema.push({
        name: tableName,
        error: error.message || 'Lỗi không xác định.',
        rowCount: 0,
        columns: []
      });
    }
    if (index < tables.length - 1) {
      await delay(1100);
    }
  }

  const output = options.format === 'json'
    ? `${JSON.stringify(schema, null, 2)}\n`
    : renderMarkdown(schema, options.sampleSize);

  if (options.output) {
    const outputPath = path.resolve(rootDir, options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Đã ghi lược đồ Google Sheets vào ${outputPath}`);
    return;
  }

  console.log(output);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
