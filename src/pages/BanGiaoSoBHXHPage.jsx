import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BookMarked, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildBanGiaoSoPayload,
  buildBanGiaoSoTemplateData,
  fetchBanGiaoSoRelated,
  fetchBanGiaoSoRow,
  getBanGiaoSoIdFromSearch
} from '../features/banGiaoSoBhxh';

const TEMPLATE_URL = '/ban_giao_so_bhxh_template.docx?v=utf8-20260529';

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
  .bhxh-actions { print-color-adjust: exact; }
  .bhxh-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.45; color: #000; }
  .bhxh-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 2cm 2.2cm 2cm 2.6cm; background: #fff; border: none; }
  .bhxh-center { text-align: center; }
  .bhxh-bold { font-weight: 700; }
  .bhxh-title { margin: 12px 0 0; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .bhxh-subtitle { text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .bhxh-row { margin: 6px 0; text-align: justify; }
  .bhxh-line { margin: 5px 0; }
  .bhxh-section { margin-top: 10px; }
  .bhxh-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 30px; }
  .bhxh-sign-table td { text-align: center; vertical-align: top; }
  .bhxh-sign-title { font-weight: 700; text-transform: uppercase; }
  .bhxh-sign-note { margin-top: 4px; font-style: italic; }
  .bhxh-sign-space { height: 96px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .bhxh-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .bhxh-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải biên bản bàn giao sổ BHXH. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'Google Sheets trả về lỗi khi tải biên bản bàn giao sổ BHXH. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const BanGiaoSoBHXHPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idBanGiaoSo = useMemo(() => getBanGiaoSoIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idBanGiaoSo);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idBanGiaoSo);
  }, [idBanGiaoSo]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBanGiaoSo]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_BanGiaoSo trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_BanGiaoSo', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idBanGiaoSo) {
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
      const row = await fetchBanGiaoSoRow(idBanGiaoSo);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildBanGiaoSoPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchBanGiaoSoRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildBanGiaoSoPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải biên bản nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
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

      doc.render(buildBanGiaoSoTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Ban_giao_so_BHXH_${payload.idBanGiaoSo || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idBanGiaoSo || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_BanGiaoSo trước khi mở bản HTML.');
      return;
    }

    window.open(`/ban_giao_so_bhxh_standalone.html?ID_BanGiaoSo=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="bhxh-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <BookMarked className="h-6 w-6 text-violet-700" />
                  Bàn giao sổ BHXH
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idBanGiaoSo ? `Đã tải biên bản ${idBanGiaoSo}.` : 'Nhập ID_BanGiaoSo để tải dữ liệu từ Google Sheets.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID biên bản bàn giao sổ BHXH"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_BanGiaoSo"
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

      {!idBanGiaoSo && (
        <Card className="bhxh-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID biên bản để bắt đầu</CardTitle>
            <CardDescription>Điền ID_BanGiaoSo vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="bhxh-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-violet-700" />
              <div>
                <p className="font-semibold">Đang tải biên bản bàn giao sổ BHXH</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ Google Sheets, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="bhxh-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được biên bản
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="bhxh-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã lên biên bản chính, đang tải thêm thông tin BHXH, nhân sự và đơn vị...</p>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="overflow-x-auto pb-4">
            <div className="bhxh-document min-w-[21cm]">
              <div className="bhxh-page">
                <div className="bhxh-center bhxh-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="bhxh-center bhxh-bold">Độc lập - Tự do - Hạnh phúc</div>

                <div className="bhxh-title">BIÊN BẢN GIAO, NHẬN</div>
                <div className="bhxh-subtitle">SỔ BẢO HIỂM XÃ HỘI</div>
                <div className="bhxh-subtitle">BẢN CHÍNH</div>

                <div className="bhxh-row">
                  Hôm nay, ngày {payload.ngayGiaoNhan.day || '...'} tháng {payload.ngayGiaoNhan.month || '...'} năm {payload.ngayGiaoNhan.year || '...'}, tại {payload.tenDonViGiao || '................................'}, chúng tôi gồm:
                </div>

                <div className="bhxh-section">
                  <div className="bhxh-line"><strong>BÊN GIAO:</strong> {(payload.tenDonViGiaoUpper || '').toUpperCase()}</div>
                  <div className="bhxh-line">- Mã số thuế: {payload.maSoThueDonVi}</div>
                  <div className="bhxh-line">- Địa chỉ: {payload.diaChiDonVi}</div>
                  <div className="bhxh-line">- Họ và tên người giao: {payload.hoTenNguoiGiao}</div>
                </div>

                <div className="bhxh-section">
                  <div className="bhxh-line"><strong>BÊN NHẬN:</strong> NGƯỜI LAO ĐỘNG</div>
                  <div className="bhxh-line">- Họ và tên: {payload.hoTenNguoiLaoDong}</div>
                  <div className="bhxh-line">- Chức vụ: {payload.chucVuNguoiLaoDong}</div>
                  <div className="bhxh-line">- Địa chỉ: {payload.diaChiNguoiLaoDong}</div>
                  <div className="bhxh-line">- Số CCCD: {payload.soCccd}; ngày cấp: {payload.ngayCapCccd}; nơi cấp: {payload.noiCapCccd}</div>
                </div>

                <div className="bhxh-section">
                  <div className="bhxh-row">Thực hiện giao, nhận các giấy tờ như sau:</div>
                  <div className="bhxh-line"><strong>1. Sổ BHXH số {payload.soSoBhxh}</strong></div>
                  <div className="bhxh-line">a) Số lượng:</div>
                  <div className="bhxh-line">- Bìa sổ (bằng số): {payload.soBiaSo} bìa sổ</div>
                  <div className="bhxh-line">- Trang sổ tờ rời (bằng số): {payload.soTrangSoToRoi} tờ, bằng chữ: {payload.soTrangSoToRoiText} tờ rời.</div>
                  <div className="bhxh-line">b) Hiện trạng sổ BHXH lúc giao nhận: {payload.hienTrangSo}</div>
                  <div className="bhxh-line"><strong>2. Quyết định nghỉ việc</strong></div>
                </div>

                <div className="bhxh-row">
                  Bên nhận xác nhận đã nhận đủ các giấy tờ nêu trên. Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.
                </div>

                <table className="bhxh-sign-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td>
                        <div className="bhxh-sign-title">BÊN GIAO</div>
                        <div className="bhxh-sign-note">(Kí & ghi rõ họ tên)</div>
                      </td>
                      <td>
                        <div className="bhxh-sign-title">BÊN NHẬN</div>
                        <div className="bhxh-sign-note">(Kí & ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr>
                      <td><div className="bhxh-sign-space" /></td>
                      <td><div className="bhxh-sign-space" /></td>
                    </tr>
                    <tr>
                      <td className="bhxh-bold">{payload.hoTenNguoiGiao}</td>
                      <td className="bhxh-bold">{payload.hoTenNguoiNhan || payload.hoTenNguoiLaoDong}</td>
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

export default BanGiaoSoBHXHPage;
