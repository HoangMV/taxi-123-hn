async function readJsonResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.trim().slice(0, 40).toLowerCase();
      if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.');
      }
      throw new Error('Không đọc được phản hồi JSON từ API dashboard.');
    }
  }
  if (!response.ok) {
    throw new Error(data.error || `Không tải được dashboard QLVT (${response.status}).`);
  }
  return data;
}

export async function fetchDashboardQlvt() {
  const response = await fetch('/api/dashboard-qlvt', {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  return readJsonResponse(response);
}
