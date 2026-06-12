import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildChamDutHopDongPayload,
  buildChamDutHopDongTemplateData,
  fetchChamDutHopDongRelated,
  fetchChamDutHopDongRow,
  getChamDutHopDongIdFromSearch
} from '../features/chamDutHopDongLaoDong';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/cham_dut_hop_dong_lao_dong_template.docx?v=20260610';

function normalizeDocxZipEntryNames(zip, PizZip) {
  const normalizedZip = new PizZip();

  Object.entries(zip.files).forEach(([entryName, file]) => {
    if (file.dir) return;
    normalizedZip.file(entryName.replace(/\\/g, '/'), file.asUint8Array());
  });

  return normalizedZip;
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_');
}

const previewStyles = `
  @page { size: A4; margin: 1.5cm; }
  .cdhd-actions { print-color-adjust: exact; }
  .cdhd-document { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.28; color: #000; }
  .cdhd-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.45cm 1.7cm 1.55cm 2.15cm; background: #fff; border: none; }
  .cdhd-header { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 14px; align-items: start; }
  .cdhd-center { text-align: center; }
  .cdhd-right { text-align: right; }
  .cdhd-bold { font-weight: 700; }
  .cdhd-company { font-weight: 700; text-transform: uppercase; }
  .cdhd-national { font-weight: 700; text-transform: uppercase; }
  .cdhd-motto { font-weight: 700; }
  .cdhd-number-date { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 14px; margin-top: 4px; }
  .cdhd-title { margin: 22px 0 0; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .cdhd-subtitle { margin: 0 0 16px; text-align: center; font-weight: 700; font-style: italic; }
  .cdhd-director { margin: 0 0 10px; text-align: center; font-weight: 700; text-transform: uppercase; }
  .cdhd-row { margin: 4px 0; text-align: justify; }
  .cdhd-indent { text-indent: 34px; }
  .cdhd-decision-title { margin: 12px 0 7px; text-align: center; font-size: 15pt; font-weight: 700; text-transform: uppercase; }
  .cdhd-section-title { margin-top: 7px; font-weight: 700; }
  .cdhd-info-table, .cdhd-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .cdhd-info-table { margin: 4px 0 7px; }
  .cdhd-info-table td { padding: 1px 0; vertical-align: top; }
  .cdhd-info-table .label { width: 112px; white-space: nowrap; }
  .cdhd-sign-table { margin-top: 18px; }
  .cdhd-sign-table td { vertical-align: top; }
  .cdhd-sign-title { text-align: center; font-weight: 700; text-transform: uppercase; }
  .cdhd-sign-note { margin-top: 4px; text-align: center; font-style: italic; }
  .cdhd-sign-space { height: 86px; }
  .cdhd-recipients { font-size: 11pt; line-height: 1.25; }
  .cdhd-signer-name { text-align: center; font-weight: 700; }
  .cdhd-signer-title { text-align: center; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .cdhd-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .cdhd-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải quyết định chấm dứt HĐLĐ. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải quyết định chấm dứt HĐLĐ. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const ChamDutHopDongLaoDongPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idChamDutHD = useMemo(() => getChamDutHopDongIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idChamDutHD);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idChamDutHD);
  }, [idChamDutHD]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idChamDutHD]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ChamDutHD trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_ChamDutHD', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idChamDutHD) {
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
      const row = await fetchChamDutHopDongRow(appSheetService, idChamDutHD);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildChamDutHopDongPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchChamDutHopDongRelated(appSheetService, row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildChamDutHopDongPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải quyết định nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
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

      doc.render(buildChamDutHopDongTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const fileToken = sanitizeFileName(payload.soQuyetDinh || payload.idChamDutHD || 'new');

      saveAs(blob, `Quyet_dinh_cham_dut_HDLD_${fileToken}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idChamDutHD || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ChamDutHD trước khi mở bản HTML.');
      return;
    }

    window.open(`/cham_dut_hop_dong_lao_dong_standalone.html?ID_ChamDutHD=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="cdhd-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <FileText className="h-6 w-6 text-rose-700" />
                  Chấm dứt HĐLĐ
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idChamDutHD ? `Đã tải quyết định ${idChamDutHD}.` : 'Nhập ID_ChamDutHD để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID quyết định chấm dứt hợp đồng lao động"
                className="h-10 w-full rounded-xl sm:w-[230px] xl:w-[250px]"
                placeholder="Nhập ID_ChamDutHD"
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

      {!idChamDutHD && (
        <Card className="cdhd-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID quyết định để bắt đầu</CardTitle>
            <CardDescription>Điền ID_ChamDutHD và bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="cdhd-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-rose-700" />
              <div>
                <p className="font-semibold">Đang tải quyết định chấm dứt HĐLĐ</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="cdhd-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được quyết định
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="cdhd-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã lên quyết định chính, đang tải thêm thông tin nhân sự, hợp đồng lao động, đơn vị và người ký...</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto pb-4">
            <div className="cdhd-document min-w-[21cm]">
              <div className="cdhd-page">
                <div className="cdhd-header">
                  <div className="cdhd-center cdhd-company">{payload.tenDonViUpper || 'CÔNG TY'}</div>
                  <div className="cdhd-center">
                    <div className="cdhd-national">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="cdhd-motto">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>

                <div className="cdhd-number-date">
                  <div className="cdhd-row">Số: {payload.soQuyetDinh || '...'}</div>
                  <div className="cdhd-row cdhd-right">
                    <em>
                      {payload.diaDiemQuyetDinh || '...'}, ngày {payload.ngayQuyetDinh.day || '...'} tháng {payload.ngayQuyetDinh.month || '...'} năm {payload.ngayQuyetDinh.year || '...'}
                    </em>
                  </div>
                </div>

                <div className="cdhd-title">Quyết định</div>
                <div className="cdhd-subtitle">(V/v: Chấm dứt hợp đồng lao động)</div>
                <div className="cdhd-director">GIÁM ĐỐC {payload.tenDonViUpper || 'CÔNG TY'}</div>

                <div className="cdhd-row cdhd-indent">Căn cứ Bộ luật Lao động 2019 số 45/2019/QH14 ngày 20/11/2019;</div>
                <div className="cdhd-row cdhd-indent">Căn cứ Điều lệ tổ chức và hoạt động của Công ty;</div>
                <div className="cdhd-row cdhd-indent">Căn cứ đơn xin nghỉ việc của Ông/Bà {payload.hoTenNhanSu || '................................'};</div>

                <div className="cdhd-decision-title">Quyết định</div>

                <div className="cdhd-section-title">Điều 1. Chấm dứt hợp đồng lao động</div>
                <div className="cdhd-row">- Chấm dứt hợp đồng lao động đối với Ông/Bà:</div>
                <table className="cdhd-info-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td className="label cdhd-bold">Họ và tên:</td>
                      <td className="cdhd-bold">{payload.hoTenNhanSu}</td>
                    </tr>
                    <tr>
                      <td className="label">Ngày sinh:</td>
                      <td>{payload.ngaySinh}</td>
                    </tr>
                    <tr>
                      <td className="label">Chức danh:</td>
                      <td>{payload.chucDanh}</td>
                    </tr>
                    <tr>
                      <td className="label">Địa chỉ:</td>
                      <td>{payload.diaChiNhanSu}</td>
                    </tr>
                    <tr>
                      <td className="label">CCCD số:</td>
                      <td>{payload.soCccd} do {payload.noiCapCccd} cấp ngày {payload.ngayCapCccd}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="cdhd-row">- Thời điểm chấm dứt hợp đồng lao động: từ ngày {payload.ngayChamDutText || '...'}.</div>
                <div className="cdhd-row">- Lý do chấm dứt: {payload.lyDoChamDut}</div>

                <div className="cdhd-section-title">Điều 2: Quyền lợi và nghĩa vụ</div>
                <div className="cdhd-row">- Ông/Bà {payload.hoTenNhanSu} có trách nhiệm bàn giao công việc, tài sản, công cụ lao động cho Công ty theo quy định.</div>
                <div className="cdhd-row">- Phòng Kế toán có trách nhiệm:</div>
                <div className="cdhd-row cdhd-indent">Thu hồi thẻ BHYT, thẻ nhân viên, thẻ từ;</div>
                <div className="cdhd-row cdhd-indent">Thực hiện thanh toán đầy đủ các khoản tiền lương, trợ cấp (nếu có) và các quyền lợi khác liên quan cho người lao động theo quy định pháp luật;</div>

                <div className="cdhd-section-title">Điều 3: Tổ chức thực hiện</div>
                <div className="cdhd-row">- Ông/Bà {payload.hoTenNhanSu} và các phòng ban liên quan chịu trách nhiệm thi hành quyết định này.</div>

                <table className="cdhd-sign-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td className="cdhd-recipients">
                        <div className="cdhd-bold">Nơi nhận:</div>
                        <div>- Như điều 1;</div>
                        <div>- Lưu VP Công ty.</div>
                      </td>
                      <td>
                        <div className="cdhd-sign-title">Giám đốc công ty</div>
                        <div className="cdhd-sign-note">(Ký, ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr>
                      <td />
                      <td><div className="cdhd-sign-space" /></td>
                    </tr>
                    <tr>
                      <td />
                      <td>
                        <div className="cdhd-signer-name">{payload.hoTenNguoiKy}</div>
                        <div className="cdhd-signer-title">{payload.chucVuNguoiKy}</div>
                      </td>
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

export default ChamDutHopDongLaoDongPage;
