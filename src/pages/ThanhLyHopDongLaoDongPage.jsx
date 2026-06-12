import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildThanhLyHopDongPayload,
  buildThanhLyHopDongTemplateData,
  fetchThanhLyHopDongRelated,
  fetchThanhLyHopDongRow,
  getThanhLyHopDongIdFromSearch,
  shouldFetchThanhLyHopDongRelated
} from '../features/thanhLyHopDongLaoDong';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/thanh_ly_hop_dong_lao_dong_template.docx?v=20260611';

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
  .tlhd-actions { print-color-adjust: exact; }
  .tlhd-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.45; color: #000; }
  .tlhd-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.85cm 2.1cm 1.8cm 2.45cm; background: #fff; border: none; }
  .tlhd-header { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 18px; align-items: start; }
  .tlhd-center { text-align: center; }
  .tlhd-bold { font-weight: 700; }
  .tlhd-company, .tlhd-national { font-weight: 700; text-transform: uppercase; }
  .tlhd-motto { font-weight: 700; }
  .tlhd-row { margin: 6px 0; text-align: justify; }
  .tlhd-number { margin-top: 10px; }
  .tlhd-title { margin: 24px 0 18px; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .tlhd-section { margin-top: 10px; }
  .tlhd-section-title { margin-bottom: 4px; font-weight: 700; }
  .tlhd-party-table, .tlhd-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .tlhd-party-table { margin: 8px 0 10px; }
  .tlhd-party-table td { padding: 2px 0; vertical-align: top; }
  .tlhd-party-table .label { width: 72px; font-weight: 700; }
  .tlhd-party-table .sub-label { width: 104px; }
  .tlhd-party-table .colon { width: 14px; }
  .tlhd-list { margin: 4px 0 4px 30px; padding: 0; list-style: none; }
  .tlhd-list li { margin: 3px 0; text-indent: -16px; padding-left: 16px; }
  .tlhd-list li::before { content: "- "; }
  .tlhd-signatures { margin-top: 30px; }
  .tlhd-sign-table td { text-align: center; vertical-align: top; }
  .tlhd-sign-title { font-weight: 700; text-transform: uppercase; }
  .tlhd-sign-note { margin-top: 4px; font-style: italic; }
  .tlhd-sign-space { height: 100px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .tlhd-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .tlhd-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải biên bản thanh lý HĐLĐ. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải biên bản thanh lý HĐLĐ. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const ThanhLyHopDongLaoDongPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idThanhLyHD = useMemo(() => getThanhLyHopDongIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idThanhLyHD);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);
  const missingRequiredFields = payload?.missingRequiredFields || [];
  const canExport = payload && missingRequiredFields.length === 0;

  useEffect(() => {
    setIdInput(idThanhLyHD);
  }, [idThanhLyHD]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idThanhLyHD]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThanhLyHD trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_ThanhLyHD', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idThanhLyHD) {
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
      const row = await fetchThanhLyHopDongRow(appSheetService, idThanhLyHD);
      if (loadRequestIdRef.current !== requestId) return;

      const initialPayload = buildThanhLyHopDongPayload(row);
      setPayload(initialPayload);
      setLoading(false);

      if (!shouldFetchThanhLyHopDongRelated(initialPayload)) {
        setLoadingRelated(false);
        return;
      }

      setLoadingRelated(true);

      try {
        const related = await fetchThanhLyHopDongRelated(appSheetService, row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildThanhLyHopDongPayload(row, related));
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
    if (!canExport) return;

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

      doc.render(buildThanhLyHopDongTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const fileToken = sanitizeFileName(payload.soBienBan || payload.idThanhLyHD || 'new');

      saveAs(blob, `Thanh_ly_HDLD_${fileToken}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idThanhLyHD || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThanhLyHD trước khi mở bản HTML.');
      return;
    }

    window.open(`/thanh_ly_hop_dong_lao_dong_standalone.html?ID_ThanhLyHD=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="tlhd-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <FileText className="h-6 w-6 text-cyan-700" />
                  Thanh lý HĐLĐ
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idThanhLyHD ? `Đã tải biên bản ${idThanhLyHD}.` : 'Nhập ID_ThanhLyHD để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID biên bản thanh lý hợp đồng lao động"
                className="h-10 w-full rounded-xl sm:w-[230px] xl:w-[250px]"
                placeholder="Nhập ID_ThanhLyHD"
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
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={exporting || loadingRelated || !canExport}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idThanhLyHD && (
        <Card className="tlhd-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID biên bản để bắt đầu</CardTitle>
            <CardDescription>Điền ID_ThanhLyHD và bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="tlhd-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-cyan-700" />
              <div>
                <p className="font-semibold">Đang tải biên bản thanh lý HĐLĐ</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="tlhd-actions border-amber-200 bg-amber-50/80">
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
            <Card className="tlhd-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã tải biên bản chính, đang tải thêm thông tin nhân sự, hợp đồng lao động, quyết định chấm dứt và đơn vị...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loadingRelated && missingRequiredFields.length > 0 && (
            <Card className="tlhd-actions border-amber-200 bg-amber-50/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-amber-950">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                  Thiếu dữ liệu để xuất Word
                </CardTitle>
                <CardDescription className="text-amber-900">
                  Cần bổ sung hoặc resolve các trường: {missingRequiredFields.join(', ')}.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="overflow-x-auto pb-4">
            <div className="tlhd-document min-w-[21cm]">
              <div className="tlhd-page">
                <div className="tlhd-header">
                  <div className="tlhd-center tlhd-company">{payload.tenDonViUpper || 'CÔNG TY'}</div>
                  <div className="tlhd-center">
                    <div className="tlhd-national">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="tlhd-motto">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>

                <div className="tlhd-row tlhd-number">Số: {payload.soBienBan || '...'}</div>
                <div className="tlhd-title">Biên bản thanh lý hợp đồng lao động</div>

                <div className="tlhd-row">
                  Hôm nay, ngày {payload.ngayLap.day || '...'} tháng {payload.ngayLap.month || '...'} năm {payload.ngayLap.year || '...'}, tại {payload.tenDonVi || '................................'}, chúng tôi gồm:
                </div>

                <table className="tlhd-party-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td className="label">BÊN A</td>
                      <td className="colon">:</td>
                      <td><strong>{payload.tenDonViUpper}</strong></td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Địa chỉ</td>
                      <td className="colon">:</td>
                      <td>{payload.diaChiDonVi}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- MST</td>
                      <td className="colon">:</td>
                      <td>{payload.maSoThueDonVi}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Đại diện</td>
                      <td className="colon">:</td>
                      <td>Ông/Bà <strong>{payload.daiDienDonVi}</strong> {payload.chucVuDaiDien ? `Chức danh: ${payload.chucVuDaiDien}` : ''}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>(“Người sử dụng lao động” hoặc “NSDLĐ”)</td>
                    </tr>
                    <tr>
                      <td className="label">BÊN B</td>
                      <td className="colon">:</td>
                      <td>Ông/Bà <strong>{payload.hoTenNhanSu}</strong></td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Địa chỉ</td>
                      <td className="colon">:</td>
                      <td>{payload.diaChiNhanSu}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- CCCD</td>
                      <td className="colon">:</td>
                      <td>{payload.soCccd}</td>
                    </tr>
                    <tr>
                      <td />
                      <td />
                      <td>Ngày cấp: {payload.ngayCapCccd} &nbsp;&nbsp; Nơi cấp: {payload.noiCapCccd}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>(“Người lao động” hoặc “NLĐ”)</td>
                    </tr>
                  </tbody>
                </table>

                <div className="tlhd-row">
                  Cùng nhau lập và ký biên bản này để thực hiện việc thanh lý Hợp đồng lao động số: <strong>{payload.soHopDongLaoDong}</strong> ký ngày <strong>{payload.ngayKyHopDongLaoDong}</strong> theo các thoả thuận sau đây:
                </div>

                <div className="tlhd-section">
                  <div className="tlhd-section-title">Điều 1. Lý do thanh lý hợp đồng</div>
                  <ul className="tlhd-list">
                    <li>{payload.lyDoThanhLy || 'Người lao động đã có đơn xin nghỉ việc và được Công ty chấp thuận chấm dứt hợp đồng lao động.'}</li>
                    <li>Hợp đồng lao động chấm dứt kể từ ngày {payload.ngayChamDutText || '...'}.</li>
                  </ul>
                </div>

                <div className="tlhd-section">
                  <div className="tlhd-section-title">Điều 2. Cam kết các bên</div>
                  <ul className="tlhd-list">
                    <li>Người lao động có trách nhiệm bàn giao đầy đủ công việc, phương tiện, trang thiết bị kèm theo phương tiện cho Công ty, đồng thời thanh toán các khoản nghĩa vụ tài chính còn tồn đọng với Công ty (nếu có).</li>
                    <li>Công ty có trách nhiệm thanh toán đầy đủ tiền lương, thưởng và các quyền lợi hợp pháp khác cho người lao động theo quy định (nếu có).</li>
                    <li>Các phòng ban liên quan có trách nhiệm xác nhận việc hoàn tất nghĩa vụ của người lao động để làm căn cứ thanh lý.</li>
                    <li>Sau khi hoàn tất việc thanh toán và bàn giao, hai bên không còn khiếu nại, tranh chấp liên quan đến Hợp đồng lao động đã ký.</li>
                  </ul>
                </div>

                <div className="tlhd-section">
                  <div className="tlhd-section-title">Điều 3. Hiệu lực biên bản</div>
                  <ul className="tlhd-list">
                    <li>Các bên đã đọc kỹ, hiểu rõ và đồng ý ký vào biên bản thanh lý này.</li>
                    <li>Biên bản này có hiệu lực kể từ ngày ký. Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</li>
                  </ul>
                </div>

                <div className="tlhd-signatures">
                  <table className="tlhd-sign-table" aria-hidden="true">
                    <tbody>
                      <tr>
                        <td>
                          <div className="tlhd-sign-title">Người sử dụng lao động</div>
                          <div className="tlhd-sign-note">(Ký và đóng dấu)</div>
                        </td>
                        <td>
                          <div className="tlhd-sign-title">Người lao động</div>
                          <div className="tlhd-sign-note">(Ký và ghi rõ họ tên)</div>
                        </td>
                      </tr>
                      <tr>
                        <td><div className="tlhd-sign-space" /></td>
                        <td><div className="tlhd-sign-space" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThanhLyHopDongLaoDongPage;
