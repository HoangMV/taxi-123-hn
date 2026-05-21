function sendJson(response, statusCode, data) {
  response.status(statusCode);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.send(JSON.stringify(data));
}

function readRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return request.body ? JSON.parse(request.body) : {};
  }

  return {};
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Chỉ hỗ trợ phương thức POST.' });
    return;
  }

  const appId = process.env.REACT_APP_APP_ID || '';
  const accessKey = process.env.REACT_APP_ACCESS_KEY || '';
  const region = process.env.REACT_APP_REGION || 'www';

  if (!appId || !accessKey || !region) {
    sendJson(response, 500, {
      error: 'Thiếu cấu hình AppSheet trên server. Hãy kiểm tra biến môi trường của Vercel.'
    });
    return;
  }

  try {
    const body = readRequestBody(request);
    const tableName = String(body.tableName || '').trim();
    const action = String(body.action || 'Find').trim();
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!tableName) {
      sendJson(response, 400, { error: 'Tên bảng là bắt buộc.' });
      return;
    }

    const appSheetResponse = await fetch(
      `https://${region}.appsheet.com/api/v2/apps/${appId}/tables/${encodeURIComponent(tableName)}/Action`,
      {
        method: 'POST',
        headers: {
          ApplicationAccessKey: accessKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Action: action,
          ...payload
        })
      }
    );

    const text = await appSheetResponse.text();
    response.status(appSheetResponse.status);
    response.setHeader('Content-Type', appSheetResponse.headers.get('content-type') || 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.send(text || '[]');
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Proxy AppSheet gặp lỗi.'
    });
  }
};
