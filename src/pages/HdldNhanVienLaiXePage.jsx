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

const TEMPLATE_URL = '/hdld_nhan_vien_lai_xe_template.docx?v=preview-match-word-20260622';

function normalizeDocxZipEntryNames(zip, PizZip) {
  const normalizedZip = new PizZip();

  Object.entries(zip.files).forEach(([entryName, file]) => {
    if (file.dir) return;
    normalizedZip.file(entryName.replace(/\\/g, '/'), file.asUint8Array());
  });

  return normalizedZip;
}

function normalizeFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildExportFileName(payload) {
  const personName = normalizeFileNamePart(payload?.hoTenNhanSu);
  const identifier = normalizeFileNamePart(payload?.soHopDong || payload?.idHopDongLaoDong || 'new');
  return ['HDLD_nhan_vien_lai_xe', personName, identifier].filter(Boolean).join('_') + '.docx';
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
  .hdld-subtitle { margin-top: 4px; font-weight: 700; }
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

      saveAs(blob, buildExportFileName(payload));
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
                <div className="hdld-center">-----o0o-----</div>

                <div className="hdld-title">HỢP ĐỒNG LAO ĐỘNG</div>
                <div className="hdld-center">Số: {payload.soHopDong || '...'}</div>

                <div className="hdld-section">
                  <div className="hdld-line">Căn cứ:</div>
                  <div className="hdld-line">- Bộ luật Lao động số 45/2019/QH14 ngày 20/11/2019;</div>
                  <div className="hdld-line">- Căn cứ Nội quy lao động của Công ty có hiệu lực từ ngày 31/05/2026;</div>
                  <div className="hdld-line">- Căn cứ nhu cầu và năng lực của hai bên;</div>
                </div>

                <div className="hdld-row">
                  Hôm nay, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'}, tại {payload.tenDonVi || '................................'}, chúng tôi gồm:
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>BÊN A:</strong> {payload.tenDonViUpper || ''}</div>
                  <div className="hdld-line">- Địa chỉ: {payload.diaChiDonVi}</div>
                  <div className="hdld-line">- MST: {payload.maSoThueDonVi}</div>
                  <div className="hdld-line">- Đại diện: Ông/Bà {payload.hoTenNguoiKy} &nbsp;&nbsp;&nbsp;&nbsp; Chức danh: {payload.chucVuNguoiKy}</div>
                  <div className="hdld-line">("Người sử dụng lao động" hoặc "NSDLĐ")</div>
                  <div className="hdld-line hdld-bold">VÀ</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>BÊN B:</strong> Ông/Bà {payload.hoTenNhanSu}</div>
                  <div className="hdld-line">- Ngày sinh: {payload.ngaySinh}</div>
                  <div className="hdld-line">- Địa chỉ: {payload.diaChiNhanSu}</div>
                  <div className="hdld-line">- CCCD: {payload.soCccd} &nbsp;&nbsp; Ngày cấp: {payload.ngayCapCccd} &nbsp;&nbsp; Nơi cấp: {payload.noiCapCccd}</div>
                  <div className="hdld-line">- Số GPLX: {payload.soGplx} &nbsp;&nbsp; Hạng bằng: {payload.hangGplx}</div>
                  <div className="hdld-line">("Người lao động" hoặc "NLĐ")</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line">Sau khi thỏa thuận, hai Bên thống nhất ký Hợp đồng lao động (HĐLĐ) với các điều khoản sau:</div>
                  <div className="hdld-line"><strong>Điều 1. Công việc, địa điểm và thời gian làm việc</strong></div>
                  <div className="hdld-line">1.1. Chức danh: {payload.chucDanh}</div>
                  <div className="hdld-line">1.2. Mô tả công việc:</div>
                  <div className="hdld-line hdld-indent">- Thực hiện vận chuyển hành khách theo sự điều hành của Công ty thông qua các ứng dụng, tổng đài điều phối.</div>
                  <div className="hdld-line hdld-indent">- Quản lý, sử dụng phương tiện được giao đúng mục đích; bảo quản tài sản, trang thiết bị, giấy tờ xe.</div>
                  <div className="hdld-line hdld-indent">- Thực hiện các nghĩa vụ liên quan đến an toàn giao thông, an toàn lao động, phòng chống cháy nổ theo quy định và tuân theo nội quy, quy chế của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Thực hiện các công việc khác có liên quan theo sự phân công hợp lý của Công ty.</div>
                  <div className="hdld-line">1.3. Địa điểm làm việc:</div>
                  <div className="hdld-line hdld-indent">- Người lao động hoạt động trực, chờ, đón khách trong phạm vi địa bàn Công ty khai thác thị trường, ký kết hợp đồng cung cấp dịch vụ, hợp đồng điểm đỗ,... và trả khách theo nhu cầu của khách hàng.</div>
                  <div className="hdld-line hdld-indent">- Người lao động chấp nhận việc điều động, phân công địa điểm hoạt động, khu vực đón trả khách theo yêu cầu sản xuất kinh doanh của Công ty.</div>
                  <div className="hdld-line">1.4. Thời gian làm việc</div>
                  <div className="hdld-line hdld-indent">- Thời gian làm việc: 48 giờ/tuần.</div>
                  <div className="hdld-line hdld-indent">- Thời gian làm việc, nghỉ ngơi giữa ca được bố trí linh hoạt, phù hợp đặc thù vận tải và không làm thay đổi tổng thời giờ làm việc theo quy định pháp luật.</div>
                  <div className="hdld-line hdld-indent">- Người sử dụng lao động được sử dụng người lao động làm thêm giờ khi được sự đồng ý của người lao động và đảm bảo số giờ làm thêm theo đúng quy định của Pháp luật.</div>
                  <div className="hdld-line hdld-indent">- Người lao động có trách nhiệm tuân thủ quy định về thời gian lái xe liên tục, thời gian tối đa làm việc trong ngày và thời gian nghỉ giữa ca theo quy định của pháp luật về giao thông đường bộ và quy định nội bộ của Công ty.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 2. Thời hạn hợp đồng</strong></div>
                  <div className="hdld-line hdld-indent">- Loại hợp đồng lao động: {payload.loaiHopDong}.</div>
                  <div className="hdld-line hdld-indent">- Thời hạn hợp đồng lao động: {payload.thoiHanHopDongText}</div>
                  <div className="hdld-line hdld-indent">- Khi hợp đồng hết hạn, hợp đồng sẽ tự động gia hạn với thời hạn và điều kiện tương tự, trừ trường hợp một trong hai bên có thông báo chấm dứt bằng văn bản trước thời điểm hết hạn.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 3: Quyền và nghĩa vụ của người lao động</strong></div>
                  <div className="hdld-line hdld-subtitle">3.1. Quyền lợi của người lao động</div>
                  <div className="hdld-line">a) Tiền lương và phụ cấp:</div>
                  <div className="hdld-line hdld-indent">- Mức lương chính: {payload.mucLuongText || '................................'}VNĐ/tháng.</div>
                  <div className="hdld-line hdld-indent">- Mức lương chính được điều chỉnh theo quy định của Nhà nước về mức lương tối thiểu vùng và theo thang bảng lương do Công ty xây dựng.</div>
                  <div className="hdld-line hdld-indent">- Lương hiệu quả công việc: Theo quy chế lương, thưởng, phụ cấp, trợ cấp Công ty ban hành từng thời điểm và thông báo cho người lao động.</div>
                  <div className="hdld-line hdld-indent">- Hình thức trả lương: 02 lần/tháng bằng tiền mặt hoặc chuyển khoản.</div>
                  <div className="hdld-line hdld-indent">- Người lao động được tạm ứng lương theo quy định.</div>
                  <div className="hdld-line">b) Các quyền lợi khác:</div>
                  <div className="hdld-line hdld-indent">- Khen thưởng: Người lao động được khuyến khích bằng vật chất hoặc tinh thần khi có thành tích trong công tác hoặc theo quy định của công ty.</div>
                  <div className="hdld-line hdld-indent">- Chế độ nâng lương: Theo quy định của Nhà nước và Quy chế, nội quy của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Chế độ nghỉ: Theo quy định chung của Nhà nước.</div>
                  <div className="hdld-line hdld-indent">+ Nghỉ hàng tuần: được bố trí linh hoạt 01 ngày nghỉ/tuần theo kế hoạch sản xuất, kinh doanh của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Nghỉ lễ, Tết: Thực hiện theo quy định của pháp luật. Trường hợp làm việc vào ngày lễ, Tết thì được bố trí nghỉ bù và/hoặc thanh toán tiền lương theo quy định của pháp luật.</div>
                  <div className="hdld-line hdld-indent">- Chế độ Bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp: Theo quy định của Nhà nước.</div>
                  <div className="hdld-line hdld-indent">- Dụng cụ, công cụ làm việc và đồng phục: Công ty cấp phát, lắp đặt và trang bị cùng phương tiện được bàn giao.</div>
                  <div className="hdld-line hdld-indent">- Chế độ đào tạo, bồi dưỡng, nâng cao trình độ, kỹ năng nghề nghiệp cho người lao động: được xem xét hỗ trợ kinh phí đào tạo, bồi dưỡng tùy theo yêu cầu công việc, năng lực, trình độ của người lao động và nhu cầu sử dụng lao động của Công ty.</div>
                  <div className="hdld-line hdld-subtitle">3.2. Nghĩa vụ của người lao động</div>
                  <div className="hdld-line hdld-indent">- Thực hiện đúng công việc theo Hợp đồng lao động, chấp hành sự điều hành, phân công công việc của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Chấp hành Nội quy lao động, quy chế quản lý lái xe, quy chế tài chính và các quy định nội bộ khác của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Tuân thủ quy định của pháp luật về giao thông đường bộ, đảm bảo an toàn cho hành khách và phương tiện trong quá trình vận hành.</div>
                  <div className="hdld-line hdld-indent">- Sử dụng phương tiện được giao đúng mục đích; quản lý, bảo quản tài sản, trang thiết bị, giấy tờ xe và các tài sản khác của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Hoàn toàn chịu trách nhiệm trước pháp luật nếu vi phạm luật giao thông, vận chuyển hàng cấm và các hành vi không được Pháp luật cho phép khác.</div>
                  <div className="hdld-line hdld-indent">- Không được tự ý giao xe, cho mượn, cho thuê hoặc để người khác điều khiển phương tiện khi chưa được Công ty chấp thuận.</div>
                  <div className="hdld-line hdld-indent">- Thực hiện đầy đủ các nghĩa vụ tài chính phát sinh trong quá trình làm việc theo quy định của Công ty và các thỏa thuận đã ký kết.</div>
                  <div className="hdld-line hdld-indent">- Báo cáo kịp thời cho Công ty khi xảy ra tai nạn, sự cố, vi phạm giao thông hoặc các vấn đề phát sinh liên quan đến phương tiện và hoạt động vận tải.</div>
                  <div className="hdld-line hdld-indent">- Hợp tác với Công ty trong việc xử lý các vi phạm, khiếu nại của khách hàng và các vấn đề phát sinh trong quá trình cung cấp dịch vụ.</div>
                  <div className="hdld-line hdld-indent">- Bồi thường thiệt hại theo quy định của pháp luật và quy chế của Công ty trong trường hợp gây mất mát, hư hỏng tài sản hoặc gây thiệt hại do lỗi của mình.</div>
                  <div className="hdld-line hdld-indent">- Bảo mật thông tin kinh doanh, dữ liệu khách hàng, thông tin điều hành và các thông tin nội bộ khác của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Thực hiện các công việc khác có liên quan theo sự phân công hợp lý của Công ty.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 4: Quyền và nghĩa vụ của người sử dụng lao động</strong></div>
                  <div className="hdld-line hdld-subtitle">4.1. Quyền hạn của người sử dụng lao động</div>
                  <div className="hdld-line hdld-indent">- Tổ chức, điều hành sản xuất kinh doanh; phân công, điều động, bố trí ca làm việc, khu vực hoạt động của người lao động phù hợp với nhu cầu kinh doanh.</div>
                  <div className="hdld-line hdld-indent">- Tạm thời điều chuyển người lao động làm công việc khác theo quy định của pháp luật khi cần thiết.</div>
                  <div className="hdld-line hdld-indent">- Ban hành nội quy, quy chế và yêu cầu người lao động chấp hành.</div>
                  <div className="hdld-line hdld-indent">- Kiểm tra, giám sát việc thực hiện công việc, việc sử dụng phương tiện, tài sản được giao.</div>
                  <div className="hdld-line hdld-indent">- Áp dụng các hình thức kỷ luật lao động theo quy định của pháp luật.</div>
                  <div className="hdld-line hdld-indent">- Yêu cầu người lao động bồi thường thiệt hại khi gây mất mát, hư hỏng tài sản hoặc phát sinh thiệt hại do lỗi của người lao động theo quy định của pháp luật và quy chế của Công ty.</div>
                  <div className="hdld-line hdld-indent">- Đơn phương chấm dứt hợp đồng lao động, tạm hoãn hợp đồng lao động theo quy định của pháp luật.</div>
                  <div className="hdld-line hdld-subtitle">4.2. Nghĩa vụ của người sử dụng lao động</div>
                  <div className="hdld-line hdld-indent">- Bảo đảm việc làm và thực hiện đầy đủ các điều khoản đã cam kết trong Hợp đồng lao động.</div>
                  <div className="hdld-line hdld-indent">- Thanh toán đầy đủ, đúng thời hạn tiền lương và các chế độ khác cho người lao động theo thỏa thuận trong Hợp đồng lao động và quy định của pháp luật.</div>
                  <div className="hdld-line hdld-indent">- Xây dựng, ban hành và công khai Nội quy lao động, quy chế quản lý lái xe, quy chế tài chính và các quy định nội bộ khác.</div>
                  <div className="hdld-line hdld-indent">- Tôn trọng danh dự, nhân phẩm của người lao động; không được áp dụng hình thức xử lý trái pháp luật.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 5: Những thỏa thuận khác</strong></div>
                  <div className="hdld-line hdld-indent">- Trong quá trình thực hiện hợp đồng nếu một bên có nhu cầu thay đổi nội dung trong Hợp đồng phải báo cho bên kia trước ít nhất 03 ngày và ký kết bản Phụ lục Hợp đồng theo quy định của pháp luật. Trong thời gian tiến hành thỏa thuận hai bên vẫn tuân theo Hợp đồng lao động đã ký kết.</div>
                  <div className="hdld-line hdld-indent">- Người lao động đọc kỹ, hiểu rõ và cam kết thực hiệm các điều khoản và quy định ghi tại Hợp đồng lao động.</div>
                </div>

                <div className="hdld-section">
                  <div className="hdld-line"><strong>Điều 6: Điều khoản thi hành</strong></div>
                  <div className="hdld-line hdld-indent">- Những vấn đề về lao động không ghi trong Hợp đồng này thì áp dụng theo quy định của thỏa ước tập thể, nội quy lao động và pháp luật lao động.</div>
                  <div className="hdld-line hdld-indent">- Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản. Khi hai bên ký kết phụ lục hợp đồng thì nội dung của phụ lục hợp đồng cũng có giá trị như các nội dung của bản hợp đồng này.</div>
                </div>

                <table className="hdld-sign-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td>
                        <div className="hdld-sign-title">Người sử dụng lao động</div>
                        <div className="hdld-sign-note">(Ký và đóng dấu)</div>
                      </td>
                      <td>
                        <div className="hdld-sign-title">Người lao động</div>
                        <div className="hdld-sign-note">(Ký và ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr>
                      <td><div className="hdld-sign-space" /></td>
                      <td><div className="hdld-sign-space" /></td>
                    </tr>
                    <tr>
                      <td className="hdld-bold" />
                      <td className="hdld-bold" />
                    </tr>
                  </tbody>
                </table>              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HdldNhanVienLaiXePage;
