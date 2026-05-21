const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const publicDir = path.join(rootDir, 'public');
const runtimeOutputPath = path.join(publicDir, 'runtime-config.js');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const result = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = value;
  });

  return result;
}

const env = { ...parseEnvFile(envPath), ...process.env };

const runtimeConfig = {
  APP_ID: env.REACT_APP_APP_ID || '',
  REGION: env.REACT_APP_REGION || 'www',
  DEFAULT_TABLE: env.REACT_APP_DEFAULT_TABLE || '',
  API_PROXY_URL: env.REACT_APP_API_PROXY_URL || '/api/appsheet'
};

const runtimeOutput = `window.__APPSHEET_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};\n`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(runtimeOutputPath, runtimeOutput, 'utf8');

console.log(`Generated ${path.relative(rootDir, runtimeOutputPath)}`);
