import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildHdldNhanVienLaiXePayload,
  buildHdldNhanVienLaiXeTemplateData,
  fetchHdldNhanVienLaiXeRelated,
  fetchHdldNhanVienLaiXeRow,
  getHdldNhanVienLaiXeIdFromSearch
} from '../features/hdldNhanVienLaiXe';

const TEMPLATE_URL = '/hdld_nhan_vien_lai_xe_template.docx?v=thoi-han-20260618';

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
  .hdld-actions { print-color-adjust: exact; }
  .hdld-document { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; color: #000; }
  .hdld-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.6cm 1.8cm 1.6cm 2.2cm; background: #fff; border: none; }
  .hdld-center { text-align: center; }
  .hdld-bold { font-weight: 700; }
  .hdld-title { margin: 10px 0 6px; text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .hdld-row { margin: 4px 0; text-align: justify; }
  .hdld-line { margin: 3px 0; }
  .hdld-section { margin-top: 8px; }
  .hdld-indent { padding-left: 24px; }
  .hdld-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 24px; }
  .hdld-sign-table td { text-align: center; vertical-align: top; }
  .hdld-sign-title { font-weight: 700; text-transform: uppercase; }
  .hdld-sign-note { margin-top: 4px; font-style: italic; }
  .hdld-sign-space { height: 84px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .hdld-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .hdld-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải HĐLĐ nhân viên lái xe. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'Google Sheets trả về lỗi khi tải HĐLĐ nhân viên lái xe. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const HdldNhanVienLaiXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idHopDongLaoDong = useMemo(() => getHdldNhanVienLaiXeIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idHopDongLaoDong);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idHopDongLaoDong);
  }, [idHopDongLaoDong]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idHopDongLaoDong]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HopDongLaoDong trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_HopDongLaoDong', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idHopDongLaoDong) {
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
      const row = await fetchHdldNhanVienLaiXeRow(idHopDongLaoDong);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildHdldNhanVienLaiXePayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchHdldNhanVienLaiXeRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildHdldNhanVienLaiXePayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải hợp đồng nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
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

      doc.render(buildHdldNhanVienLaiXeTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `HDLD_nhan_vien_lai_xe_${payload.soHopDong || payload.idHopDongLaoDong || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idHopDongLaoDong || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HopDongLaoDong trước khi mở bản HTML.');
      return;
    }

    window.open(`/hdld_nhan_vien_lai_xe_standalone.html?ID_HopDongLaoDong=${encodeURIComponent(nextId)}`, '_blank');
  }

  const disableExport = exporting || loadingRelated || !payload;

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="hdld-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <FileText className="h-6 w-6 text-indigo-700" />
                  HĐLĐ nhân viên lái xe
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idHopDongLaoDong ? `Đã tải hợp đồng ${idHopDongLaoDong}.` : 'Nhập ID_HopDongLaoDong để tải dữ liệu từ Google Sheets.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hợp đồng lao động"
                className="h-10 w-full rounded-xl sm:w-[240px] xl:w-[260px]"
                placeholder="Nhập ID_HopDongLaoDong"
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
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={disableExport}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idHopDongLaoDong && (
        <Card className="hdld-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hợp đồng để bắt đầu</CardTitle>
            <CardDescription>Điền ID_HopDongLaoDong vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="hdld-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-700" />
              <div>
                <p className="font-semibold">Đang tải HĐLĐ nhân viên lái xe</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ Google Sheets, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="hdld-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được hợp đồng
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="hdld-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã lên hợp đồng chính, đang tải thêm thông tin nhân sự, đơn vị, chức danh và lương...</p>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="overflow-x-auto pb-4">
            <div className="hdld-document min-w-[21cm]">
              <div className="hdld-page">
                <div className="hdld-center hdld-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="hdld-center hdld-bold">Độc lập - Tự do - Hạnh phúc</div>

                <div className="hdld-title">HỢP ĐỒNG LAO ĐỘNG</div>
                <div className="hdld-center">Số: {payload.soHopDong || '...'}</div>

                <div className="hdld-row">
                  Hôm nay, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'} tại {payload.tenDonVi || '................................'}, chúng tôi gồm:
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>BÊN A:</strong> {payload.tenDonViUpper || ''}</div>
                  <div className="hdld-line">Địa chỉ: {payload.diaChiDonVi}</div>
                  <div className="hdld-line">Mã số thuế: {payload.maSoThueDonVi}</div>
                  <div className="hdld-line">Đại diện: {payload.hoTenNguoiKy} - Chức danh: {payload.chucVuNguoiKy}</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>BÊN B:</strong> {payload.hoTenNhanSu}</div>
                  <div className="hdld-line">Ngày sinh: {payload.ngaySinh}</div>
                  <div className="hdld-line">Địa chỉ thường trú: {payload.diaChiNhanSu}</div>
                  <div className="hdld-line">Số CCCD: {payload.soCccd}; ngày cấp: {payload.ngayCapCccd}; nơi cấp: {payload.noiCapCccd}</div>
                  <div className="hdld-line">GPLX số: {payload.soGplx}; hạng bằng: {payload.hangGplx}</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 1. Công việc và địa điểm làm việc</strong></div>
                  <div className="hdld-line hdld-indent">Chức danh: {payload.chucDanh}; bộ phận: {payload.boPhan || '................................'}.</div>
                  <div className="hdld-line hdld-indent">Người lao động thực hiện công việc lái xe taxi và các công việc liên quan theo sự phân công của Công ty.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 2. Thời hạn hợp đồng</strong></div>
                  <div className="hdld-line hdld-indent">Loại hợp đồng lao động: {payload.loaiHopDong}.</div>
                  <div className="hdld-line hdld-indent">Thời hạn hợp đồng lao động: {payload.thoiHanHopDongText}.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 3. Tiền lương và chế độ</strong></div>
                  <div className="hdld-line hdld-indent">Mức lương chính: {payload.mucLuongText || '................................'} VNĐ/tháng.</div>
                  <div className="hdld-line hdld-indent">Bằng chữ: {payload.mucLuongBangChu || '................................'}.</div>
                  <div className="hdld-line hdld-indent">Các khoản phụ cấp, thưởng và chế độ khác thực hiện theo quy chế của Công ty và quy định pháp luật hiện hành.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 4. Cam kết chung</strong></div>
                  <div className="hdld-line hdld-indent">Hai bên cam kết thực hiện đúng các điều khoản trong hợp đồng này và các quy định pháp luật lao động hiện hành.</div>
                </div>

                <table className="hdld-sign-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td>
                        <div className="hdld-sign-title">Người sử dụng lao động</div>
                        <div className="hdld-sign-note">(Ký, ghi rõ họ tên)</div>
                      </td>
                      <td>
                        <div className="hdld-sign-title">Người lao động</div>
                        <div className="hdld-sign-note">(Ký, ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr>
                      <td><div className="hdld-sign-space" /></td>
                      <td><div className="hdld-sign-space" /></td>
                    </tr>
                    <tr>
                      <td className="hdld-bold">{payload.hoTenNguoiKy}</td>
                      <td className="hdld-bold">{payload.hoTenNhanSu}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HdldNhanVienLaiXePage;
