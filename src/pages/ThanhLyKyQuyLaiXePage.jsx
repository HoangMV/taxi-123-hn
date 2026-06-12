import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, HandCoins, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildThanhLyKyQuyPayload,
  buildThanhLyKyQuyTemplateData,
  fetchThanhLyKyQuyRelated,
  fetchThanhLyKyQuyRow,
  getThanhLyKyQuyIdFromSearch,
  shouldFetchThanhLyKyQuyRelated
} from '../features/thanhLyKyQuyLaiXe';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/thanh_ly_ky_quy_lai_xe_template.docx?v=20260602';

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
  .tlkq-actions { print-color-adjust: exact; }
  .tlkq-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.45; color: #000; }
  .tlkq-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 2cm 2.2cm 2cm 2.6cm; background: #fff; border: none; }
  .tlkq-header { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .tlkq-center { text-align: center; }
  .tlkq-bold { font-weight: 700; }
  .tlkq-title { margin: 24px 0 0; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .tlkq-subtitle { margin: 2px 0 18px; text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .tlkq-row { margin: 6px 0; text-align: justify; }
  .tlkq-section { margin-top: 10px; }
  .tlkq-section-title { margin-bottom: 4px; font-weight: 700; }
  .tlkq-party-table, .tlkq-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .tlkq-party-table { margin: 8px 0 10px; }
  .tlkq-party-table td { padding: 2px 0; vertical-align: top; }
  .tlkq-party-table .label { width: 72px; font-weight: 700; }
  .tlkq-party-table .sub-label { width: 104px; }
  .tlkq-party-table .colon { width: 14px; }
  .tlkq-list { margin: 4px 0 4px 30px; padding: 0; list-style: none; }
  .tlkq-list li { margin: 3px 0; text-indent: -16px; padding-left: 16px; }
  .tlkq-list li::before { content: "- "; }
  .tlkq-signatures { margin-top: 30px; }
  .tlkq-sign-table td { text-align: center; vertical-align: top; }
  .tlkq-sign-title { font-weight: 700; text-transform: uppercase; }
  .tlkq-sign-note { margin-top: 4px; font-style: italic; }
  .tlkq-sign-space { height: 96px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .tlkq-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .tlkq-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải biên bản thanh lý ký quỹ. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải biên bản thanh lý ký quỹ. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const ThanhLyKyQuyLaiXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idThanhLy = useMemo(() => getThanhLyKyQuyIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idThanhLy);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idThanhLy);
  }, [idThanhLy]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idThanhLy]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThanhLy trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_ThanhLy', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idThanhLy) {
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
      const row = await fetchThanhLyKyQuyRow(appSheetService, idThanhLy);
      if (loadRequestIdRef.current !== requestId) return;

      const initialPayload = buildThanhLyKyQuyPayload(row);
      setPayload(initialPayload);
      setLoading(false);

      if (!shouldFetchThanhLyKyQuyRelated(initialPayload)) {
        setLoadingRelated(false);
        return;
      }

      setLoadingRelated(true);

      try {
        const related = await fetchThanhLyKyQuyRelated(appSheetService, row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildThanhLyKyQuyPayload(row, related));
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

      doc.render(buildThanhLyKyQuyTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Thanh_ly_ky_quy_${payload.soBienBan || payload.idThanhLy || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idThanhLy || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThanhLy trước khi mở bản HTML.');
      return;
    }

    window.open(`/thanh_ly_ky_quy_lai_xe_standalone.html?ID_ThanhLy=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="tlkq-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <HandCoins className="h-6 w-6 text-emerald-700" />
                  Thanh lý ký quỹ lái xe
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idThanhLy ? `Đã tải biên bản ${idThanhLy}.` : 'Nhập ID_ThanhLy để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID biên bản thanh lý ký quỹ"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_ThanhLy"
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

      {!idThanhLy && (
        <Card className="tlkq-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID biên bản để bắt đầu</CardTitle>
            <CardDescription>Điền ID_ThanhLy và bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="tlkq-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
              <div>
                <p className="font-semibold">Đang tải biên bản thanh lý ký quỹ</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="tlkq-actions border-amber-200 bg-amber-50/80">
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
            <Card className="tlkq-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã lên biên bản chính, đang tải thêm thông tin ký quỹ và hợp đồng lao động...</p>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="overflow-x-auto pb-4">
            <div className="tlkq-document min-w-[21cm]">
              <div className="tlkq-page">
                <div className="tlkq-header">
                  <div className="tlkq-center tlkq-bold">
                    <div>{payload.tenDonViUpper || 'CÔNG TY'}</div>
                  </div>
                  <div className="tlkq-center">
                    <div className="tlkq-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="tlkq-bold">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>
                <div className="tlkq-row">Số: {payload.soBienBan}</div>

                <div className="tlkq-title">Biên bản thanh lý</div>
                <div className="tlkq-subtitle">Hợp đồng đặt cọc đảm bảo trách nhiệm tài sản</div>

                <div className="tlkq-row">
                  Hôm nay, ngày {payload.ngayLap.day || '...'} tháng {payload.ngayLap.month || '...'} năm {payload.ngayLap.year || '...'},
                  tại {payload.tenDonVi || '................................'}, chúng tôi gồm:
                </div>

                <table className="tlkq-party-table" aria-hidden="true">
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
                      <td className="label">BÊN B</td>
                      <td className="colon">:</td>
                      <td>Ông/Bà <strong>{payload.tenNhanSu}</strong></td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Địa chỉ</td>
                      <td className="colon">:</td>
                      <td>{payload.diaChiNhanSu}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- CCCD</td>
                      <td className="colon">:</td>
                      <td>{payload.soCccd} &nbsp;&nbsp; Ngày cấp: {payload.ngayCapCccd} &nbsp;&nbsp; Nơi cấp: {payload.noiCapCccd}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="tlkq-row">
                  Cùng nhau lập và ký biên bản này để thực hiện việc thanh lý Hợp đồng đặt cọc đảm bảo trách nhiệm tài sản số
                  {' '}<strong>{payload.soHopDongDatCoc}</strong> ký ngày <strong>{payload.ngayKyHopDongDatCoc}</strong> theo các thỏa thuận sau đây:
                </div>

                <div className="tlkq-section">
                  <div className="tlkq-section-title">Điều 1. Lý do thanh lý hợp đồng</div>
                  <ul className="tlkq-list">
                    <li>{payload.lyDoThanhLy || 'Bên B chấm dứt hợp đồng lao động và đã thực hiện thủ tục nghỉ việc theo quy định của Công ty.'}</li>
                    {payload.ngayChamDutText && <li>Ngày chấm dứt hợp đồng lao động: {payload.ngayChamDutText}.</li>}
                  </ul>
                </div>

                <div className="tlkq-section">
                  <div className="tlkq-section-title">Điều 2. Thanh toán tiền đặt cọc</div>
                  <ul className="tlkq-list">
                    <li>Bên B đã hoàn thành việc bàn giao công việc, tài sản và các nghĩa vụ liên quan nếu có.</li>
                    <li>Số tiền ký quỹ còn lại: {payload.soTienKyQuyConLaiText || '0'} đồng.</li>
                    <li>Số tiền khấu trừ: {payload.soTienKhauTruText || '0'} đồng.</li>
                    <li>Bên A thanh toán cho Bên B số tiền cọc sau khi cấn trừ các khoản công nợ tồn đọng là: {payload.soTienHoanTraText || '0'} đồng (Bằng chữ: {payload.soTienHoanTraBangChu || 'Không'} đồng).</li>
                    <li>Hình thức thanh toán: {payload.hinhThucThanhToan || '................................'}.</li>
                  </ul>
                </div>

                <div className="tlkq-section">
                  <div className="tlkq-section-title">Điều 3. Cam kết các bên</div>
                  <ul className="tlkq-list">
                    <li>Sau khi ký biên bản này, nếu không còn nghĩa vụ phát sinh, hai bên không còn khiếu nại, tranh chấp liên quan đến khoản tiền đặt cọc nêu trên.</li>
                    <li>Các chứng từ, phiếu thu tiền cọc và hợp đồng đặt cọc đã ký kết chấm dứt hiệu lực thực hiện kể từ thời điểm biên bản này ký kết.</li>
                  </ul>
                </div>

                <div className="tlkq-section">
                  <div className="tlkq-section-title">Điều 4. Hiệu lực biên bản</div>
                  <ul className="tlkq-list">
                    <li>Các bên đã đọc kỹ, hiểu rõ và đồng ý ký vào biên bản thanh lý này.</li>
                    <li>Biên bản này có hiệu lực kể từ ngày ký. Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</li>
                  </ul>
                </div>

                <div className="tlkq-signatures">
                  <table className="tlkq-sign-table" aria-hidden="true">
                    <tbody>
                      <tr>
                        <td>
                          <div className="tlkq-sign-title">Đại diện bên A</div>
                          <div className="tlkq-sign-note">(Ký và đóng dấu)</div>
                        </td>
                        <td>
                          <div className="tlkq-sign-title">Đại diện bên B</div>
                          <div className="tlkq-sign-note">(Ký và ghi rõ họ tên)</div>
                        </td>
                      </tr>
                      <tr>
                        <td><div className="tlkq-sign-space" /></td>
                        <td><div className="tlkq-sign-space" /></td>
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

export default ThanhLyKyQuyLaiXePage;
