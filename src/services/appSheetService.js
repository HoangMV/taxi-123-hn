import config from '../config/config';

class AppSheetService {
  ensureConfig() {
    if (!config.API_PROXY_URL) {
      throw new Error('Thiếu cấu hình AppSheet. Hãy kiểm tra file .env.');
    }
  }

  async request(tableName, action, payload = {}) {
    this.ensureConfig();

    if (!tableName) {
      throw new Error('Tên bảng là bắt buộc.');
    }

    const response = await fetch(config.API_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tableName,
        action,
        payload
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AppSheet ${response.status}: ${errorText || 'Yêu cầu thất bại'}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }

  find(tableName, selector = '') {
    const payload = selector
      ? {
          Properties: {
            Selector: selector
          }
        }
      : {};

    return this.request(tableName, 'Find', payload);
  }

  add(tableName, rows) {
    return this.request(tableName, 'Add', { Rows: rows });
  }

  update(tableName, rows) {
    return this.request(tableName, 'Edit', { Rows: rows });
  }

  remove(tableName, rows) {
    return this.request(tableName, 'Delete', { Rows: rows });
  }
}

const appSheetService = new AppSheetService();

export default appSheetService;
