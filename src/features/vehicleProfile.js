function cleanValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function readJsonResponseError(text) {
  const preview = cleanValue(text).slice(0, 40).toLowerCase();
  if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
    return 'API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.';
  }
  return 'Không đọc được phản hồi JSON từ API hồ sơ phương tiện.';
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(readJsonResponseError(text));
    }
  }
  if (!response.ok) {
    throw new Error(data.error || `Không tải được hồ sơ phương tiện (${response.status}).`);
  }
  return data;
}

export function getVehicleProfileIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return cleanValue(params.get('ID_Xe') || params.get('idXe') || params.get('idxe') || params.get('IDXe'));
}

export async function fetchVehicleProfile(idXe) {
  const params = new URLSearchParams();
  params.set('ID_Xe', cleanValue(idXe));
  const response = await fetch(`/api/vehicle-profile?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  return readJsonResponse(response);
}

export function sanitizeFileToken(value) {
  return cleanValue(value)
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[.\-]/g, '')
    .toUpperCase();
}

export function buildVehicleProfilePdfFileName(profile) {
  const bienSo = sanitizeFileToken(profile?.vehicle?.bienSo || profile?.vehicle?.idXe || 'XE');
  const year = cleanValue(profile?.meta?.year || new Date().getFullYear());
  return `HOSO_DIENTU_XE_${bienSo}_${year}.pdf`;
}

export async function downloadVehicleProfilePdf(element, profile) {
  if (!element) throw new Error('Chưa tìm thấy vùng nội dung hồ sơ để xuất PDF.');
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = html2pdfModule.default || html2pdfModule;
  const fileName = buildVehicleProfilePdfFileName(profile);

  await html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', '.avoid-break', '.vp-card']
      }
    })
    .from(element)
    .save();
}
