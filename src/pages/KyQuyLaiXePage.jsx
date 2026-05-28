import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, HandCoins, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildKyQuyTemplateData,
  fetchKyQuyData,
  getKyQuyIdFromSearch
} from '../features/kyQuyLaiXe';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/ky_quy_lai_xe_template.docx';

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
  .kq-actions { print-color-adjust: exact; }
  .kq-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.45; color: #000; }
  .kq-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 2cm 2.2cm 2cm 2.6cm; background: #fff; border: none; }
  .kq-center { text-align: center; }
  .kq-bold { font-weight: 700; }
  .kq-title { margin: 12px 0 0; text-align: center; font-size: 18pt; font-weight: 700; text-transform: uppercase; }
  .kq-subtitle { margin-bottom: 12px; text-align: center; font-weight: 700; }
  .kq-row { margin: 4px 0; text-align: justify; }
  .kq-indent { padding-left: 28px; text-indent: -28px; }
  .kq-list { margin: 2px 0 2px 34px; padding: 0; list-style: none; }
  .kq-list li { margin: 2px 0; text-indent: -16px; padding-left: 16px; }
  .kq-list li::before { content: "- "; }
  .kq-evidence-title { margin: 8px 0 4px; font-weight: 700; text-decoration: underline; }
  .kq-evidence-list { margin: 0 0 8px 30px; padding-left: 18px; list-style: disc; }
  .kq-evidence-list li { margin: 2px 0; font-style: italic; }
  .kq-party-table, .kq-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .kq-party-table { margin: 6px 0 8px; }
  .kq-party-table td { padding: 2px 0; vertical-align: top; }
  .kq-party-table .label { width: 78px; font-weight: 700; }
  .kq-party-table .colon { width: 14px; }
  .kq-party-table .sub-label { width: 108px; }
  .kq-party-table .value { word-break: break-word; }
  .kq-article { margin-top: 10px; }
  .kq-article-title { margin-bottom: 4px; font-weight: 700; }
  .kq-signatures { margin-top: 28px; }
  .kq-sign-title { font-weight: 700; text-transform: uppercase; }
  .kq-sign-note { margin-top: 4px; font-style: italic; }
  .kq-sign-space { height: 96px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .kq-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .kq-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải hợp đồng ký quỹ. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải hợp đồng ký quỹ. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

const KyQuyLaiXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idKyQuy = useMemo(() => getKyQuyIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idKyQuy);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idKyQuy);
  }, [idKyQuy]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKyQuy]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_KyQuy trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_KyQuy', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idKyQuy) {
      setPayload(null);
      setErrorMessage('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setErrorMessage('');
      const nextPayload = await fetchKyQuyData(appSheetService, idKyQuy);
      if (loadRequestIdRef.current !== requestId) return;
      setPayload(nextPayload);
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

      doc.render(buildKyQuyTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Ky_quy_lai_xe_${payload.soHopDong || payload.idKyQuy || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idKyQuy || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_KyQuy trước khi mở bản HTML.');
      return;
    }

    window.open(`/ky_quy_lai_xe_standalone.html?ID_KyQuy=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="kq-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <HandCoins className="h-6 w-6 text-sky-700" />
                  Ký quỹ lái xe
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idKyQuy ? `Đã tải hợp đồng ${idKyQuy}.` : 'Nhập ID_KyQuy để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hợp đồng ký quỹ"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_KyQuy"
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
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={exporting || loading || !payload}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idKyQuy && (
        <Card className="kq-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hợp đồng để bắt đầu</CardTitle>
            <CardDescription>Điền ID_KyQuy vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="kq-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-sky-700" />
              <div>
                <p className="font-semibold">Đang tải hợp đồng ký quỹ</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="kq-actions border-amber-200 bg-amber-50/80">
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
          <div className="overflow-x-auto pb-4">
            <div className="kq-document min-w-[21cm]">
              <div className="kq-page">
                <div className="kq-center kq-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="kq-center kq-bold">Độc lập - Tự do - Hạnh phúc</div>
                <div className="kq-center kq-bold">-----o0o-----</div>

                <div className="kq-title">HỢP ĐỒNG ĐẶT CỌC</div>
                <div className="kq-title">ĐẢM BẢO TRÁCH NHIỆM TÀI SẢN</div>
                <div className="kq-subtitle">Số: {payload.soHopDong}</div>

                <div className="kq-evidence-title">Căn cứ:</div>
                <ul className="kq-evidence-list">
                  <li>Bộ luật Dân sự 2015 (Luật số 91/2015/QH13) có hiệu lực từ ngày 01/01/2017;</li>
                  <li>Nghị định 21/2021/NĐ-CP quy định thi hành Bộ luật Dân sự về bảo đảm thực hiện nghĩa vụ có hiệu lực từ ngày 15/05/2021;</li>
                  <li>Nhu cầu và sự tự nguyện thỏa thuận của các bên;</li>
                </ul>

                <div className="kq-row">
                  Hôm nay, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'},
                  tại {payload.tenDonVi || '................................'}, chúng tôi gồm:
                </div>

                <table className="kq-party-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td className="label">BÊN A</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}><strong>{payload.tenDonVi}</strong></td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Địa chỉ</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}>{payload.diaChiDonVi}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- MST</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}>{payload.maSoThueDonVi}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Đại diện</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}>Ông {payload.nguoiDaiDienDonVi} {payload.chucVuNguoiDaiDien ? `Chức danh: ${payload.chucVuNguoiDaiDien}` : ''}</td>
                    </tr>
                    <tr>
                      <td className="value" colSpan={5}><strong>(“Bên Nhận cọc”)</strong></td>
                    </tr>
                    <tr>
                      <td className="label">VÀ</td>
                      <td className="colon" />
                      <td className="value" colSpan={3} />
                    </tr>
                    <tr>
                      <td className="label">BÊN B</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}>Ông/Bà {payload.hoTenLaiXe}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- Địa chỉ</td>
                      <td className="colon">:</td>
                      <td className="value" colSpan={3}>{payload.diaChiDayDu}</td>
                    </tr>
                    <tr>
                      <td className="sub-label">- CCCD</td>
                      <td className="colon">:</td>
                      <td className="value">{payload.soCccd}</td>
                      <td className="value">Ngày cấp: {payload.ngayCapCccd}</td>
                      <td className="value">Nơi cấp: {payload.noiCapCccd}</td>
                    </tr>
                    <tr>
                      <td className="value" colSpan={5}>(“Bên đặt cọc”)</td>
                    </tr>
                  </tbody>
                </table>

                <div className="kq-row">
                  Sau khi thỏa thuận, hai Bên thống nhất ký Hợp đồng đặt cọc đảm bảo trách nhiệm tài sản với các điều khoản sau:
                </div>

                <div className="kq-article">
                  <div className="kq-article-title">Điều 1. Nội dung hợp đồng</div>
                  <div className="kq-row kq-indent">1.1. Bên B tự nguyện nộp cho Bên A một khoản tiền đặt cọc nhằm đảm bảo việc thực hiện các nghĩa vụ đã cam kết với Bên A, bao gồm nhưng không giới hạn:</div>
                  <ul className="kq-list">
                    <li>Nghĩa vụ theo Hợp đồng lao động;</li>
                    <li>Nghĩa vụ giao nhận, quản lý, sử dụng tài sản;</li>
                    <li>Nghĩa vụ theo nội quy, quy chế và các cam kết khác của Bên B với Công ty.</li>
                  </ul>
                  <div className="kq-row kq-indent">1.2. Khoản tiền đặt cọc này là thỏa thuận dân sự độc lập, không thay thế các nghĩa vụ theo Hợp đồng lao động.</div>
                  <div className="kq-row">- Số tiền đặt cọc: {payload.soTienPhaiNopText} đồng (Bằng chữ: {payload.soTienPhaiNopBangChu} đồng).</div>
                  <div className="kq-row kq-indent">1.3. Bên A cung cấp phiếu thu nhận tiền cho Bên B.</div>
                </div>

                <div className="kq-article">
                  <div className="kq-article-title">Điều 2. Quyền và nghĩa vụ của Bên B</div>
                  <div className="kq-row kq-indent">2.1. Quyền của Bên B</div>
                  <ul className="kq-list">
                    <li>Được hưởng đầy đủ các quyền lợi theo Hợp đồng lao động và các thỏa thuận đã ký với Bên A.</li>
                    <li>Bên B được hưởng khoản lãi trên số tiền đặt cọc theo mức lãi suất không kỳ hạn do ngân hàng công bố tại thời điểm thanh toán nếu Bên B không vi phạm các nghĩa vụ hợp đồng, thỏa thuận ký kết giữa hai bên.</li>
                    <li>Bên B nhận lại tiền đặt cọc và lãi khi đồng thời: chấm dứt HĐLĐ; hoàn tất bàn giao tài sản; hoàn thành toàn bộ nghĩa vụ tài chính với Bên A; không có tranh chấp hoặc nghĩa vụ chưa hoàn thành.</li>
                    <li>Trường hợp Bên B có nghĩa vụ tài chính chưa thanh toán đầy đủ cho Bên A, thì Bên B sẽ được nhận lại phần tiền còn lại sau khi đã cấn trừ các nghĩa vụ hợp pháp (nếu có).</li>
                    <li>Thời hạn hoàn trả: trong vòng 60 ngày kể từ ngày chấm dứt HĐLĐ và hoàn tất nghĩa vụ.</li>
                  </ul>
                  <div className="kq-row kq-indent">2.2. Nghĩa vụ của Bên B</div>
                  <ul className="kq-list">
                    <li>Nộp đủ tiền đặt cọc trước khi nhận tài sản hoặc thực hiện công việc theo thỏa thuận.</li>
                    <li>Tuân thủ đầy đủ nội quy, quy chế của Công ty và tuân thủ các điều khoản theo hợp đồng, thỏa thuận giữa hai bên.</li>
                    <li>Bảo quản, sử dụng tài sản được giao đúng mục đích; chịu trách nhiệm bồi thường thiệt hại nếu gây hư hỏng, mất mát do lỗi của mình.</li>
                    <li>Thanh toán đầy đủ các khoản công nợ, nghĩa vụ tài chính với Công ty (nếu có).</li>
                    <li>Xuất trình đầy đủ: Hợp đồng này, chứng từ nộp tiền, biên bản thanh lý HĐLĐ khi đến hạn nhận lại khoản cọc.</li>
                  </ul>
                </div>

                <div className="kq-article">
                  <div className="kq-article-title">Điều 3. Quyền và nghĩa vụ của Bên A</div>
                  <div className="kq-row kq-indent">3.1. Quyền của Bên A</div>
                  <ul className="kq-list">
                    <li>Yêu cầu Bên B thực hiện đầy đủ các nghĩa vụ đã cam kết.</li>
                    <li>Được cấn trừ tiền đặt cọc để bù đắp các khoản sau: thiệt hại tài sản do lỗi của Bên B; các khoản công nợ, nghĩa vụ tài chính chưa thanh toán.</li>
                    <li>Trường hợp tiền đặt cọc không đủ bù đắp thiệt hại, Bên A có quyền yêu cầu Bên B thanh toán phần còn thiếu theo quy định pháp luật.</li>
                  </ul>
                  <div className="kq-row kq-indent">3.2. Nghĩa vụ của Bên A</div>
                  <ul className="kq-list">
                    <li>Hoàn trả tiền đặt cọc (và lãi, nếu có) cho Bên B đúng thời hạn sau khi hai bên đã hoàn tất nghĩa vụ.</li>
                  </ul>
                </div>

                <div className="kq-article">
                  <div className="kq-article-title">Điều 4. Điều khoản chung</div>
                  <ul className="kq-list">
                    <li>Hai bên cam kết việc ký kết hợp đồng là tự nguyện, không bị ép buộc.</li>
                    <li>Trường hợp phát sinh tranh chấp, hai bên ưu tiên giải quyết bằng thương lượng; nếu không đạt được thỏa thuận thì đưa ra Tòa án có thẩm quyền giải quyết.</li>
                    <li>Hợp đồng có hiệu lực từ ngày {payload.ngayKyText} đến hết ngày {payload.ngayHetHanText}. Khi hết thời hạn, nếu hai bên không có thỏa thuận khác, hợp đồng tự động gia hạn cho đến khi có văn bản hoặc hợp đồng khác thay thế.</li>
                    <li>Hợp đồng được lập thành 02 bản, có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</li>
                  </ul>
                </div>

                <div className="kq-signatures">
                  <table className="kq-sign-table" aria-hidden="true">
                    <tbody>
                      <tr>
                        <td className="kq-center">
                          <div className="kq-sign-title">BÊN NHẬN CỌC</div>
                          <div className="kq-sign-note">(Ký và đóng dấu)</div>
                        </td>
                        <td className="kq-center">
                          <div className="kq-sign-title">BÊN ĐẶT CỌC</div>
                          <div className="kq-sign-note">(Ký và ghi rõ họ tên)</div>
                        </td>
                      </tr>
                      <tr>
                        <td><div className="kq-sign-space" /></td>
                        <td><div className="kq-sign-space" /></td>
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

export default KyQuyLaiXePage;
