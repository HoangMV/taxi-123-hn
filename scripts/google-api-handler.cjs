const {
  buildGoogleFeatureBundle,
  cleanValue,
  getFeatureConfig,
  getIdFromRequest
} = require('./google-feature-bundles.cjs');
const { isGoogleSheetsConfigured } = require('./google-sheets-service.cjs');

function sendJson(response, statusCode, data) {
  response.status(statusCode);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.send(JSON.stringify(data));
}

function readRequestBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return request.body ? JSON.parse(request.body) : {};
  return {};
}

function createGoogleSheetsHandler(slug) {
  return async function handler(request, response) {
    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức GET hoặc POST.' });
      return;
    }

    const config = getFeatureConfig(slug);
    if (!config) {
      sendJson(response, 500, { error: `Chưa cấu hình Google Sheets bundle cho endpoint ${slug}.` });
      return;
    }

    if (!isGoogleSheetsConfigured()) {
      sendJson(response, 500, { error: 'Thiếu cấu hình Google Sheets trên server. Hãy kiểm tra GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL và GOOGLE_PRIVATE_KEY.' });
      return;
    }

    try {
      const body = request.method === 'POST' ? readRequestBody(request) : {};
      const query = request.query || {};
      const id = getIdFromRequest(config, query, body);
      const includeRelated = cleanValue(query.includeRelated || body.includeRelated || '1') !== '0';

      if ((config.idKeys || []).length > 0 && !id) {
        sendJson(response, 400, { error: config.missingIdMessage });
        return;
      }

      const providedRow =
        body.row &&
        typeof body.row === 'object' &&
        (!config.mainKey || cleanValue(body.row[config.mainKey]) === id)
          ? body.row
          : null;
      const bundle = await buildGoogleFeatureBundle(slug, {
        id,
        includeRelated,
        providedRow,
        body,
        query
      });

      if (!bundle) {
        sendJson(response, 404, { error: `${config.notFoundPrefix} = ${id}.` });
        return;
      }

      sendJson(response, 200, bundle);
    } catch (error) {
      sendJson(response, 500, { error: error.message || config.failedMessage });
    }
  };
}

module.exports = {
  createGoogleSheetsHandler,
  readRequestBody,
  sendJson
};
