const crypto = require('crypto');

const sheetsApiBaseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const sheetsScope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const tokenCache = new Map();

function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function stripEnvQuotes(value) {
  const text = cleanValue(value);
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }

  return text;
}

function getGoogleSheetsConfig(env = process.env) {
  const spreadsheetId = stripEnvQuotes(env.GOOGLE_SHEETS_SPREADSHEET_ID);
  const clientEmail = stripEnvQuotes(env.GOOGLE_SERVICE_ACCOUNT_EMAIL || env.GOOGLE_CLIENT_EMAIL);
  const privateKey = stripEnvQuotes(env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n');

  return {
    spreadsheetId,
    clientEmail,
    privateKey
  };
}

function isGoogleSheetsConfigured(env = process.env) {
  const config = getGoogleSheetsConfig(env);
  return Boolean(config.spreadsheetId && config.clientEmail && config.privateKey);
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const claim = {
    iss: config.clientEmail,
    scope: sheetsScope,
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  };
  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(config.privateKey);

  return `${unsignedJwt}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(env = process.env) {
  const config = getGoogleSheetsConfig(env);
  if (!config.spreadsheetId || !config.clientEmail || !config.privateKey) {
    throw new Error('Thiếu cấu hình Google Sheets trong biến môi trường backend.');
  }

  const cacheKey = `${config.clientEmail}:${config.spreadsheetId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
    return cached.accessToken;
  }

  const jwt = createJwt(config);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString()
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Không lấy được access token Google Sheets (${response.status}).`);
  }

  tokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
  });

  return data.access_token;
}

function getTabName(tableName, env = process.env) {
  const cleanTableName = cleanValue(tableName);
  const rawMap = cleanValue(env.GOOGLE_SHEETS_TABLE_MAP);
  if (!rawMap) return cleanTableName;

  try {
    const map = JSON.parse(rawMap);
    return cleanValue(map?.[cleanTableName]) || cleanTableName;
  } catch {
    return cleanTableName;
  }
}

function getTableRange(tableName, env = process.env) {
  const cleanTableName = cleanValue(tableName);
  const rawMap = cleanValue(env.GOOGLE_SHEETS_RANGE_MAP);
  if (rawMap) {
    try {
      const map = JSON.parse(rawMap);
      const mappedRange = cleanValue(map?.[cleanTableName]);
      if (mappedRange) return mappedRange;
    } catch {
      // Ignore invalid optional range map and use the default range.
    }
  }

  return cleanValue(env.GOOGLE_SHEETS_DEFAULT_RANGE) || 'A:ZZ';
}

function quoteSheetRange(tabName, range) {
  return `'${String(tabName).replace(/'/g, "''")}'!${range}`;
}

function parseRows(values) {
  const allRows = Array.isArray(values) ? values : [];
  const headers = (allRows[0] || []).map(cleanValue);
  const usableHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header && !header.startsWith('Related '));

  return allRows.slice(1).map((cells) => {
    const row = {};
    usableHeaders.forEach(({ header, index }) => {
      row[header] = cleanValue(cells?.[index]);
    });
    return row;
  });
}

async function readGoogleSheetTables(tableNames, env = process.env) {
  const uniqueTableNames = [...new Set((Array.isArray(tableNames) ? tableNames : []).map(cleanValue).filter(Boolean))];
  if (uniqueTableNames.length === 0) return {};

  const config = getGoogleSheetsConfig(env);
  if (!config.spreadsheetId || !config.clientEmail || !config.privateKey) {
    throw new Error('Thiếu cấu hình Google Sheets trong biến môi trường backend.');
  }

  const accessToken = await getAccessToken(env);
  const params = new URLSearchParams({
    majorDimension: 'ROWS',
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });
  uniqueTableNames.forEach((tableName) => {
    params.append('ranges', quoteSheetRange(getTabName(tableName, env), getTableRange(tableName, env)));
  });

  const response = await fetch(`${sheetsApiBaseUrl}/${encodeURIComponent(config.spreadsheetId)}/values:batchGet?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error?.message || `Không đọc được Google Sheet (${response.status}).`);
  }

  const valueRanges = Array.isArray(data.valueRanges) ? data.valueRanges : [];
  const tables = {};
  uniqueTableNames.forEach((tableName, index) => {
    tables[tableName] = parseRows(valueRanges[index]?.values || []);
  });

  return tables;
}

function findRowById(rows, keyName, id) {
  const cleanId = cleanValue(id);
  if (!cleanId) return null;
  return (Array.isArray(rows) ? rows : []).find((row) => cleanValue(row?.[keyName]) === cleanId) || null;
}

function findRowsByIds(rows, keyName, ids) {
  const idSet = new Set((Array.isArray(ids) ? ids : []).map(cleanValue).filter(Boolean));
  if (idSet.size === 0) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => idSet.has(cleanValue(row?.[keyName])));
}

module.exports = {
  cleanValue,
  findRowById,
  findRowsByIds,
  getGoogleSheetsConfig,
  isGoogleSheetsConfigured,
  readGoogleSheetTables
};
