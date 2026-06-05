import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, IdCard, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildDeNghiCapPhuHieuPayload,
  buildDeNghiCapPhuHieuTemplateData,
  fetchDeNghiCapPhuHieuRelated,
  fetchDeNghiCapPhuHieuRow,
  getDeNghiCapPhuHieuIdFromSearch
} from '../features/deNghiCapPhuHieuXe';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/de_nghi_cap_phu_hieu_xe_template.docx?v=20260603';

function normalizeDocxZipEntryNames(zip, PizZip) {
  const normalizedZip = new PizZip();

  Object.entries(zip.files).forEach(([entryName, file]) => {
    if (file.dir) return;
    normalizedZip.file(entryName.replace(/\\/g, '/'), file.asUint8Array());
  });

  return normalizedZip;
}

const previewStyles = `
  @page { size: A4; margin: 1.5cm; }
  .dncph-actions { print-color-adjust: exact; }
  .dncph-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.4cm 1.5cm 1.6cm; background: #fff; color: #000; border: none; font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.4; }
  .dncph-header { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .dncph-center { text-align: center; }
  .dncph-bold { font-weight: 700; }
  .dncph-underlined { display: inline-block; border-bottom: 1px solid #000; padding: 0 8px 2px; }
  .dncph-org-name { margin-top: 8px; font-size: 15pt; font-weight: 700; text-transform: uppercase; }
  .dncph-meta { margin-top: 10px; }
  .dncph-title { margin: 20px 0 6px; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .dncph-row { margin: 6px 0; text-align: justify; }
  .dncph-table { width: 100%; margin-top: 10px; border-collapse: collapse; table-layout: fixed; }
  .dncph-table th, .dncph-table td { border: 1px solid #000; padding: 5px 4px; vertical-align: middle; font-size: 12.5pt; }
  .dncph-table th { text-align: center; font-weight: 700; }
  .dncph-table td { text-align: center; }
  .dncph-table td.left { text-align: left; }
  .dncph-sign { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; }
  .dncph-sign-right { text-align: center; }
  .dncph-sign-space { height: 90px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .dncph-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .dncph-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải đơn đề nghị cấp phù hiệu. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải hồ sơ đề nghị cấp phù hiệu. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

function renderValue(value, fallback = '........................................................') {
  return value || fallback;
}

function renderNumberValue(value) {
  return value || '0';
}

function VehicleTable({ payload }) {
  return (
    <table className="dncph-table">
      <thead>
        <tr>
          <th className="w-[7%]">TT</th>
          <th className="w-[14%]">Biển kiểm soát</th>
          <th className="w-[9%]">Sức chứa</th>
          <th className="w-[11%]">Nhãn hiệu xe</th>
          <th className="w-[11%]">Nước sản xuất</th>
          <th className="w-[9%]">Năm sản xuất</th>
          <th className="w-[18%]">Loại phù hiệu</th>
          <th className="w-[21%]">(*) Xe taxi</th>
        </tr>
      </thead>
      <tbody>
        {payload.danhSachXe.length ? (
          payload.danhSachXe.map((item) => (
            <tr key={`${item.stt}-${item.bienSo}`}>
              <td>{item.stt}</td>
              <td>{item.bienSo}</td>
              <td>{item.sucChua}</td>
              <td>{item.nhanHieu}</td>
              <td>{item.nuocSanXuat}</td>
              <td>{item.namSanXuat}</td>
              <td className="left">{item.loaiPhuHieu}</td>
              <td className="left">{item.phuongThucTinhTien}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={8} className="left">Chưa có xe đề nghị cấp phù hiệu trong hồ sơ này.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const DeNghiCapPhuHieuXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idHoSoPhuHieu = useMemo(() => getDeNghiCapPhuHieuIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idHoSoPhuHieu);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [soLuongNopLai, setSoLuongNopLai] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idHoSoPhuHieu);
  }, [idHoSoPhuHieu]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idHoSoPhuHieu]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoPhuHieu trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_HoSoPhuHieu', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idHoSoPhuHieu) {
      setPayload(null);
      setErrorMessage('');
      setLoading(false);
      setLoadingRelated(false);
      return;
    }

    setLoading(true);
    setLoadingRelated(false);

    try {
      setErrorMessage('');
      const row = await fetchDeNghiCapPhuHieuRow(appSheetService, idHoSoPhuHieu);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildDeNghiCapPhuHieuPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchDeNghiCapPhuHieuRelated(appSheetService, row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildDeNghiCapPhuHieuPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải hồ sơ nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoadingRelated(false);
        }
      }
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) return;
      const message = getFriendlyError(error);
      toast.error(message);
      setErrorMessage(message);
      setPayload(null);
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  async function exportToWordTemplate() {
    if (!payload) return;

    setExporting(true);
    try {
      const response = await fetch(TEMPLATE_URL);
      if (!response.ok) throw new Error('Không thể tải template Word.');

      const [{ default: PizZip }, { default: Docxtemplater }, fileSaver] = await Promise.all([
        import('pizzip'),
        import('docxtemplater'),
        import('file-saver')
      ]);
      const saveAs = fileSaver.saveAs || fileSaver.default;

      const templateContent = await response.arrayBuffer();
      const sourceZip = new PizZip(templateContent);
      const zip = normalizeDocxZipEntryNames(sourceZip, PizZip);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      doc.render(buildDeNghiCapPhuHieuTemplateData(payload, soLuongNopLai));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Don_de_nghi_cap_phu_hieu_${payload.soHoSo || payload.idHoSoPhuHieu || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idHoSoPhuHieu || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoPhuHieu trước khi mở bản HTML.');
      return;
    }

    const params = new URLSearchParams();
    params.set('ID_HoSoPhuHieu', nextId);
    if (soLuongNopLai) {
      params.set('soLuongNopLai', soLuongNopLai);
    }
    window.open(`/de_nghi_cap_phu_hieu_xe_standalone.html?${params.toString()}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="dncph-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <IdCard className="h-6 w-6 text-red-700" />
                  Đơn đề nghị cấp phù hiệu xe
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idHoSoPhuHieu ? `Đã tải hồ sơ ${idHoSoPhuHieu}.` : 'Nhập ID_HoSoPhuHieu để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hồ sơ đề nghị cấp phù hiệu"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_HoSoPhuHieu"
                value={idInput}
                onChange={(event) => setIdInput(event.target.value)}
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Tải dữ liệu
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={openStandaloneHtml}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở bản HTML
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => window.print()} disabled={!payload}>
                <Printer className="mr-2 h-4 w-4" />
                In tài liệu
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={exporting || loadingRelated || !payload}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      <Card className="dncph-actions border-slate-200 bg-white">
        <CardContent className="pt-3">
          <div className="max-w-xs">
            <label htmlFor="so-luong-nop-lai" className="mb-2 block text-sm font-medium text-slate-700">
              Số lượng phù hiệu nộp lại
            </label>
            <Input
              id="so-luong-nop-lai"
              inputMode="numeric"
              placeholder="Nhập số lượng"
              value={soLuongNopLai}
              onChange={(event) => setSoLuongNopLai(event.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
        </CardContent>
      </Card>

      {!idHoSoPhuHieu && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hồ sơ để bắt đầu</CardTitle>
            <CardDescription>Điền `ID_HoSoPhuHieu` vào ô phía trên rồi bấm “Tải dữ liệu”.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {errorMessage && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-amber-900">Không tải được hồ sơ</CardTitle>
              <CardDescription className="mt-1 text-amber-800">{errorMessage}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {payload && (
        <Card className="border-slate-200 bg-slate-100/80">
          <CardContent>
            <article className="dncph-page">
              <div className="dncph-header">
                <div className="dncph-center">
                  <div className="dncph-org-name">{renderValue(payload.tenDonVi, '........................................')}</div>
                </div>
                <div className="dncph-center">
                  <div className="dncph-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="dncph-bold dncph-underlined">Độc lập - Tự do - Hạnh phúc</div>
                </div>
              </div>

              <div className="dncph-header dncph-meta">
                <div className="dncph-center">Số: {renderValue(payload.soHoSo, '........../............')}</div>
                <div className="dncph-center">
                  {renderValue(payload.diaDanhLapDon, '........')}, ngày {renderValue(payload.ngayLap.day, '.....')} tháng {renderValue(payload.ngayLap.month, '........')} năm {renderValue(payload.ngayLap.year, '..........')}
                </div>
              </div>

              <div className="dncph-title">GIẤY ĐỀ NGHỊ CẤP (CẤP LẠI) PHÙ HIỆU</div>

              <div className="dncph-row">Kính gửi: {renderValue(payload.tenCoQuanCap, '........................................................')}</div>
              <div className="dncph-row">1. Tên đơn vị kinh doanh vận tải: {renderValue(payload.tenDonVi)}</div>
              <div className="dncph-row">2. Địa chỉ: {renderValue(payload.diaChiDonVi)}</div>
              <div className="dncph-row">3. Số điện thoại (Fax): {renderValue(payload.soDienThoai)}</div>
              <div className="dncph-row">Số lượng phù hiệu nộp lại: {renderNumberValue(soLuongNopLai)}</div>
              <div className="dncph-row">Đề nghị được cấp: {renderNumberValue(String(payload.soLuongDeNghiCap || 0))}</div>
              <div className="dncph-row">Danh sách xe đề nghị cấp phù hiệu như sau:</div>

              <VehicleTable payload={payload} />

              <div className="dncph-sign">
                <div />
                <div className="dncph-sign-right">
                  <div className="dncph-bold">ĐƠN VỊ KINH DOANH VẬN TẢI</div>
                  <div className="dncph-sign-space" />
                  <div className="dncph-bold">{payload.nguoiDaiDienDonViUpper || payload.nguoiDaiDienDonVi || payload.tenDonViUpper || payload.tenDonVi}</div>
                </div>
              </div>
            </article>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeNghiCapPhuHieuXePage;
