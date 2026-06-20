import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildThoaThuanDanSuPayload,
  buildThoaThuanDanSuTemplateData,
  fetchThoaThuanDanSuRelated,
  fetchThoaThuanDanSuRow,
  getThoaThuanDanSuIdFromSearch
} from '../features/thoaThuanDanSu';

const TEMPLATE_URL = '/thoa_thuan_dan_su_lai_xe_template.docx?v=20260620-fieldfix';

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
  .ttds-actions { print-color-adjust: exact; }
  .ttds-preview-shell { width: 100%; overflow-x: hidden; }
  .ttds-document { width: min(100%, 21cm); max-width: 21cm; margin: 0 auto; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; color: #000; }
  .ttds-page { box-sizing: border-box; width: 100%; min-height: 29.7cm; margin: 0 auto; padding: 1.6cm 1.8cm 1.6cm 2.2cm; background: #fff; border: none; }
  .ttds-center { text-align: center; }
  .ttds-bold { font-weight: 700; }
  .ttds-title { margin: 10px 0 6px; text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .ttds-subtitle { margin: 2px 0 10px; text-align: center; }
  .ttds-row { margin: 4px 0; text-align: justify; }
  .ttds-line { margin: 3px 0; }
  .ttds-section { margin-top: 8px; }
  .ttds-indent { padding-left: 24px; }
  .ttds-warning-list { margin: 0; padding-left: 18px; }
  .ttds-sign-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 24px; }
  .ttds-sign-table td { text-align: center; vertical-align: top; }
  .ttds-sign-title { font-weight: 700; text-transform: uppercase; }
  .ttds-sign-note { margin-top: 4px; font-style: italic; }
  .ttds-sign-space { height: 84px; }
  @media (max-width: 820px) {
    .ttds-document { font-size: 12pt; line-height: 1.32; }
    .ttds-page { min-height: 0; padding: 18px 14px; }
    .ttds-title { font-size: 14pt; }
    .ttds-subtitle { margin-bottom: 8px; }
    .ttds-row, .ttds-line { text-align: left; }
    .ttds-indent { padding-left: 14px; }
    .ttds-sign-table { table-layout: fixed; }
    .ttds-sign-title, .ttds-sign-note { overflow-wrap: anywhere; }
    .ttds-sign-space { height: 64px; }
  }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .ttds-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .ttds-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải thỏa thuận dân sự. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 180) {
    return 'Google Sheets trả về lỗi khi tải thỏa thuận dân sự. Vui lòng kiểm tra cấu hình và quyền truy cập.';
  }
  return message;
}

const ThoaThuanDanSuPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idTtds = useMemo(() => getThoaThuanDanSuIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idTtds);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idTtds);
  }, [idTtds]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTtds]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_TTDS trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_TTDS', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idTtds) {
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
      const row = await fetchThoaThuanDanSuRow(idTtds);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildThoaThuanDanSuPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchThoaThuanDanSuRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildThoaThuanDanSuPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải thỏa thuận chính nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
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

      doc.render(buildThoaThuanDanSuTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Thoa_thuan_dan_su_${payload.soThoaThuan || payload.idTtds || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idTtds || idInput).trim();
    if (!nextId) {
      toast.warning('Vui lòng nhập ID_TTDS trước khi mở bản HTML.');
      return;
    }
    window.open(`/thoa_thuan_dan_su_standalone.html?ID_TTDS=${encodeURIComponent(nextId)}`, '_blank');
  }

  const disableExport = exporting || loadingRelated || !payload;

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="ttds-actions overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <FileText className="h-6 w-6 text-indigo-700" />
                  Thỏa thuận trách nhiệm dân sự
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idTtds ? `Đang dùng hồ sơ ${idTtds}.` : 'Nhập ID_TTDS để tải dữ liệu từ Google Sheets.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID thỏa thuận dân sự"
                className="h-10 w-full rounded-lg sm:w-[240px] xl:w-[260px]"
                placeholder="Nhập ID_TTDS"
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

      {!idTtds && (
        <Card className="ttds-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID thỏa thuận để bắt đầu</CardTitle>
            <CardDescription>Điền ID_TTDS vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="ttds-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-700" />
              <div>
                <p className="font-semibold">Đang tải thỏa thuận trách nhiệm dân sự</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu chính từ Google Sheets.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="ttds-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được thỏa thuận
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="ttds-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã lên hồ sơ chính, đang tải thêm thông tin đơn vị, lái xe, GPLX và xe...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {payload.warnings.length > 0 && !loadingRelated && (
            <Card className="ttds-actions border-amber-200 bg-amber-50/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-base text-amber-900">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Cần kiểm tra dữ liệu liên kết
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="ttds-warning-list text-sm text-amber-900">
                  {payload.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="ttds-preview-shell pb-4">
            <div className="ttds-document">
              <div className="ttds-page">
                <div className="ttds-center ttds-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="ttds-center ttds-bold">Độc lập - Tự do - Hạnh phúc</div>
                <div className="ttds-row ttds-center">{payload.diaDiemKy || '...'}, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'}</div>

                <div className="ttds-title">Thỏa thuận trách nhiệm dân sự</div>
                <div className="ttds-subtitle">Số: {payload.soThoaThuan || '...'}</div>
                <div className="ttds-subtitle">(V/v: Nhận xe BKS: {payload.bienSoXe || '...'} - Mã đàm {payload.maDam || '...'} để kinh doanh taxi)</div>

                <div className="ttds-section">
                  <div className="ttds-line">- Căn cứ vào quy chế, quy định, nội quy của {payload.tenDonVi || 'Công ty'}.</div>
                  <div className="ttds-line">- Căn cứ vào điều kiện và khả năng thực hiện việc khai thác kinh doanh taxi của hai bên.</div>
                  <div className="ttds-line">- Hôm nay, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'}. Tại văn phòng {payload.tenDonVi || '...'}; Địa chỉ: {payload.diaChiDonVi || '...'}.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>BÊN A:</strong> {payload.tenDonViUpper}</div>
                  <div className="ttds-line">Địa chỉ: {payload.diaChiDonVi}</div>
                  <div className="ttds-line">Điện thoại: {payload.dienThoaiDonVi} {payload.maSoThueDonVi ? `- Mã số thuế: ${payload.maSoThueDonVi}` : ''}</div>
                  <div className="ttds-line">Đại diện: {payload.daiDienBenA} - Chức vụ: {payload.chucVuBenA}</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>BÊN B:</strong> {payload.hoTenLaiXeUpper}</div>
                  <div className="ttds-line">Địa chỉ: {payload.diaChiLaiXe}</div>
                  <div className="ttds-line">Ngày sinh: {payload.ngaySinhLaiXe}</div>
                  <div className="ttds-line">CCCD số: {payload.soCccd}; cấp ngày: {payload.ngayCapCccd}; nơi cấp: {payload.noiCapCccd}</div>
                  <div className="ttds-line">GPLX số: {payload.soGplx}; cấp ngày: {payload.ngayCapGplx}; hạng: {payload.hangGplx}; hạn đến: {payload.ngayHetHanGplx}</div>
                  <div className="ttds-line">Điện thoại: {payload.soDienThoaiLaiXe}</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line">Trên cơ sở được đào tạo, bồi dưỡng nghiệp vụ taxi, văn hóa doanh nghiệp và nội quy quy chế của {payload.tenDonVi || 'Công ty'}. Bên B hoàn toàn thấu hiểu các quy định của pháp luật, nội quy, quy chế các văn bản của công ty, đảm bảo tuân thủ đầy đủ và đúng các điều kiện khi tham gia hoạt động kinh doanh dịch vụ vận tải hành khách bằng taxi.</div>
                  <div className="ttds-line">Để đảm bảo quyền lợi hợp pháp của hai bên, Bên A và Bên B cùng nhất trí thỏa thuận trách nhiệm dân sự với những điều kiện cụ thể sau:</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 1: ĐIỀU KHOẢN CHUNG</strong></div>
                  <div className="ttds-line">Bên B nhận quyền sử dụng của Bên A một chiếc xe ô tô đủ điều kiện kinh doanh Taxi theo quy định của Nhà nước, được trang bị đầy đủ thiết bị, phụ tùng và dụng cụ sửa chữa nhỏ để quản lý, sử dụng nhằm mục đích kinh doanh vận chuyển hành khách bằng taxi theo quy chế kinh doanh của Công ty ban hành. Thông tin về chiếc xe ô tô như sau:</div>
                  <div className="ttds-line ttds-indent">Biển số: {payload.bienSoXe}; mã đàm: {payload.maDam}; nhãn hiệu: {payload.nhanHieuXe}.</div>
                  <div className="ttds-line ttds-indent">Số khung: {payload.soKhung}; số máy: {payload.soMay}; năm sản xuất: {payload.namSanXuat}; màu sơn: {payload.mauSon}.</div>
                  <div className="ttds-line ttds-indent">Ngày đăng ký lần đầu: {payload.ngayDangKyLanDau}.</div>
                  <div className="ttds-line"><strong>Công việc và thời gian làm việc Bên B:</strong></div>
                  <div className="ttds-line">Công việc: Lái xe Taxi và bảo quản giữ gìn xe theo đúng các quy chế tổ chức, quản lý điều hành do công ty ban hành.</div>
                  <div className="ttds-line">Thời gian làm việc do Bên B đăng ký với Công ty qua phòng điều hành, đảm bảo tuân thủ theo quy định chung của pháp luật: Thời gian làm việc không quá 10h trong một ngày và không lái xe liên tục quá 4h.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 2: ĐƠN GIÁ VÀ ĐẶT CỌC</strong></div>
                  <div className="ttds-line"><strong>Đơn giá khoán:</strong></div>
                  <div className="ttds-line ttds-indent">- Đơn giá căn cứ theo Quyết định của Bên A theo từng thời điểm và thông báo trước 07 ngày cho Bên B nếu có sự điều chỉnh.</div>
                  <div className="ttds-line ttds-indent">- Đơn giá khoán không bao gồm chi phí sạc điện và các loại chi phí nằm ngoài phần trách nhiệm của Bên A.</div>
                  <div className="ttds-line ttds-indent">- Hình thức khoán doanh thu: {payload.hinhThucKhoan || '................................'}.</div>
                  <div className="ttds-line"><strong>2.2 Đặt cọc:</strong></div>
                  <div className="ttds-line">Bên B đặt cọc cho Bên A một khoản cọc là: {payload.soTienDatCoc || '................................'} VNĐ (Bằng chữ: {payload.soTienDatCocBangChu || '................................'}).</div>
                  <div className="ttds-line">Khoản cọc sẽ được Bên A hoàn trả cho Bên B trong vòng 30 ngày kể từ thời điểm kết thúc thỏa thuận và/hoặc sau khi các bên ký Biên bản thanh lý thỏa thuận sau khi đã cấn trừ/thanh toán công nợ nếu có giữa các bên.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 3: THANH TOÁN</strong></div>
                  <div className="ttds-line">3.1 Bên B có trách nhiệm nộp tiền doanh thu khoán cùng các chi phí phát sinh khác thuộc trách nhiệm của Bên B vào ngày 25 đến ngày 30 của tháng liền kề trước đó. Đối với trường hợp khoán ngày, Bên B nộp doanh thu khoán trước 05 ngày.</div>
                  <div className="ttds-line">3.2 Chi phí sạc điện được tính theo hóa đơn thực tế của nhà cung cấp, thanh toán 02 lần/tháng.</div>
                  <div className="ttds-line">3.3 Nếu thực hiện chậm nộp các nghĩa vụ tài chính với công ty thì:</div>
                  <div className="ttds-line ttds-indent">+ Sau 03 (ba) ngày làm việc kể từ ngày hết hạn nộp tiền, Bên A có quyền cấn trừ Khoản Đặt Cọc để đảm bảo nghĩa vụ nộp tiền của Bên B;</div>
                  <div className="ttds-line ttds-indent">+ Trong trường hợp khoản cấn trừ lớn hơn Khoản Đặt Cọc thì Bên B phải chịu phạt theo lãi suất {payload.tyLePhatChamNopNgay || '................................'} trên số tiền chậm nộp sau khi đã trừ Khoản Đặt Cọc kể từ ngày đến hạn cho đến ngày nộp tiền thực tế.</div>
                  <div className="ttds-line ttds-indent">+ Mọi khoản chậm nộp của Bên B không được muộn quá 05 (năm) ngày kể từ ngày hết hạn nộp, sau 05 (năm) ngày mà Bên B không hoàn thành việc nộp bổ sung Khoản Đặt Cọc thì Bên A hoặc Bên thứ 3 (do Bên A chỉ định) tiến hành hạn chế/khóa hệ thống để dừng hoạt động của xe và tiến tới thu hồi tài sản và chấm dứt Thỏa thuận.</div>
                  <div className="ttds-line">3.4 Hình thức thanh toán: {payload.hinhThucThanhToan || '................................'}.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 4: NGHĨA VỤ, TRÁCH NHIỆM VÀ QUYỀN HẠN CỦA HAI BÊN</strong></div>
                  <div className="ttds-line"><strong>Nghĩa vụ, trách nhiệm và quyền hạn của Bên A:</strong></div>
                  <div className="ttds-line">4.1.1 Lựa chọn đơn vị bảo hiểm, kí kết hợp đồng và thực hiện gia hạn bảo hiểm trách nhiệm dân sự bắt buộc và bảo hiểm vật chất xe khi đến hạn.</div>
                  <div className="ttds-line">4.1.2 Chịu trách nhiệm về pháp lý về nguồn gốc và quyền sở hữu, sử dụng xe.</div>
                  <div className="ttds-line">4.1.3 Phối hợp cùng Bên B phát triển thị trường.</div>
                  <div className="ttds-line">4.1.4 Trả lại tiền đặt cọc cho Bên B theo điều kiện quy định tại khoản 2.2 nếu Bên B không vi phạm các điều khoản của thỏa thuận và phụ lục khác.</div>
                  <div className="ttds-line">4.1.5 Bên A có quyền chấm dứt thỏa thuận trước thời hạn nếu:</div>
                  <div className="ttds-line ttds-indent">- Bên B không chấp hành đúng chế độ tài chính và quy định và nghĩa vụ thanh toán tài chính hàng tháng với bên A.</div>
                  <div className="ttds-line ttds-indent">- Bên B phạm pháp, vi phạm pháp luật nghiêm trọng như buôn bán, vận chuyển, tàng trữ, sử dụng chất ma túy và các hàng cấm khác.</div>
                  <div className="ttds-line ttds-indent">- Sự thay đổi về chính sách Nhà nước, đình chỉ kinh doanh vận chuyển hành khách bằng xe Taxi đối với Công ty.</div>
                  <div className="ttds-line">4.1.6 Trường hợp xe bị hỏng do lỗi của nhà sản xuất và/hoặc pin xe không đáp ứng hoạt động bình thường của xe và thiết bị trong xe khiến xe không thể vận hành di chuyển được thì Bên A có thể cung cấp xe thay thế để Bên B sử dụng. Trong trường hợp Bên A không thể cung cấp xe thay thế, Bên A có trách nhiệm giảm trừ doanh thu tương ứng với số ngày xe không thể sử dụng. Để làm rõ, ngoài trách nhiệm giảm trừ doanh thu, Bên A không phải chịu bất kỳ trách nhiệm nào khác, kể cả các thiệt hại gián tiếp của Bên B (nếu có), bao gồm nhưng không giới hạn sự sụt giảm doanh thu, trách nhiệm với bên thứ ba.</div>
                  <div className="ttds-line">4.1.7 Bên A chỉ có trách nhiệm chi trả các chi phí liên quan đến việc sửa chữa xe do lỗi của Nhà sản xuất trong phạm vi bảo hành, sửa chữa/thay thế khi pin không đáp ứng hoạt động bình thường của xe và thiết bị trong xe khiến xe không thể vận hành di chuyển được nhưng không bao gồm chi phí thay thế xe trong thời gian xe bảo dưỡng định kỳ theo quy định của nhà sản xuất hoặc Bên A xét thấy cần thiết. Mọi chi phí sửa chữa xe ngoài trách nhiệm của Bên A và ngoài phạm vi bồi thường của cơ quan bảo hiểm sẽ do Bên B chi trả.</div>
                  <div className="ttds-line"><strong>Nghĩa vụ, trách nhiệm và quyền hạn của Bên B:</strong></div>
                  <div className="ttds-line">4.2.1 Tôn trọng, chấp hành đầy đủ quy chế, nội quy về phục vụ hành khách bằng xe taxi của bên A (có nội quy, quy chế và điều khoản thi hành kèm theo) cũng như các thỏa thuận kí kết khác giữa 2 bên, bao gồm tuân thủ các tiêu chuẩn đối với lái xe khi Bên A ký các thỏa thuận, hợp đồng hợp tác với đối tác, nhà cung cấp khác.</div>
                  <div className="ttds-line">4.2.2 Bảo quản, giữ gìn giấy tờ xe được bàn giao. Chịu trách nhiệm kiểm tra theo dõi thời hạn giấy tờ như: Đăng ký, Đăng kiểm, Tem kinh doanh Taxi, Bảo hiểm trách nhiệm dân sự, Bảo hiểm vật chất... Kịp thời thông báo cho bên A để cấp đổi trước khi hết hạn. Các vi phạm do lỗi hết hạn các giấy tờ liên quan đến phương tiện nói trên do Bên B không báo hay không đến Công ty để lấy giấy tờ kịp thời, Bên B phải hoàn toàn chịu trách nhiệm.</div>
                  <div className="ttds-line">4.2.3 Thanh toán các khoản phải nộp như chi phí sạc điện, chi phí bảo hiểm vật chất xe,... cho Bên A đúng thời hạn quy định.</div>
                  <div className="ttds-line">4.2.4 Sử dụng, vận hành, bảo dưỡng, bảo quản, giữ gìn tài sản được giao (xe ô tô, dụng cụ trên xe và các thiết bị bộ đàm, thiết bị giám sát hành trình, đồng hồ taximet, máy in biên lai, ứng dụng của tài xế,...) đúng mục đích kinh doanh và theo đúng quy trình, hướng dẫn của nhà sản xuất và Công ty.</div>
                  <div className="ttds-line">4.2.5 Trong quá trình sử dụng nếu phát sinh hỏng hóc, thiệt hại về xe hoặc xe gặp tai nạn, Bên B phải thông báo ngay cho bên A và/hoặc đơn vị bảo hiểm theo thông tin do bên A cung cấp tại từng thời điểm, đồng thời có trách nhiệm giải quyết mọi tranh chấp khiếu nại với bên thứ 3, phối hợp với cơ quan chức năng và phối hợp với bên A để hoàn tất các thủ tục bảo hiểm.</div>
                  <div className="ttds-line">4.2.6 Bên B có trách nhiệm cuối cùng đối với mọi hỏng hóc, thiệt hại của xe và thiệt hại với bên thứ 3 nếu do lỗi của bên B, kể cả trong trường hợp thiệt hại được đơn vị bảo hiểm chi trả. Trường hợp xe gây tai nạn hoặc liên quan đến vụ việc trái pháp luật khác do lỗi của bên B thì bên B hoàn toàn chịu trách nhiệm. Bên B có nghĩa vụ thanh toán mọi chi phí từ sự cố, hỏng hóc hoặc tai nạn không sử dụng được do lỗi của Bên B, bao gồm cả doanh thu khoán.</div>
                  <div className="ttds-line">4.2.7 Nếu Bên B hủy bỏ thỏa thuận trước thời hạn tại Điều 6, đồng thời:</div>
                  <div className="ttds-line ttds-indent">- Không thông báo trước đủ 30 ngày cho Bên A bằng văn bản thì phải bồi thường cho Bên A một khoản tương ứng 10 ca xe ngừng hoạt động theo mục 9.2 điều 9 Chương 2 trong Quy chế đối với nhân viên lái xe.</div>
                  <div className="ttds-line ttds-indent">- Thông báo trước đủ 30 ngày cho Bên A bằng văn bản; hoặc trong trường hợp Bên A có thể bố trí nhân sự thay thế Bên B sớm hơn thời gian chờ 30 ngày thì Bên B không phải chịu bồi thường ca xe.</div>
                  <div className="ttds-line ttds-indent">- Khoản bồi thường này không bao gồm các khoản bồi thường, phạt theo các hợp đồng hoặc thỏa thuận khác.</div>
                  <div className="ttds-line">4.2.8 Bên B chỉ được sử dụng xe vào các mục đích theo quy định của Bên A và phù hợp với các quy định của pháp luật, không sử dụng xe để đặt cọc, cầm cố, thế chấp, đảm bảo cho việc thực hiện nghĩa vụ dân sự hoặc sử dụng cho hoạt động vi phạm quy định pháp luật, bao gồm nhưng không giới hạn: Vận chuyển ma túy, động vật quý hiếm, tiền giả, hàng hóa dễ cháy, nổ cấm lưu thông.</div>
                  <div className="ttds-line">4.2.9 Bên B không được phép bóc tem niêm phong, tem đảm bảo, tác động hoặc can thiệp vào các hệ thống kỹ thuật, an toàn, giám sát hoặc tiện nghi của xe, tự ý thay thế, trao đổi bất kỳ phụ tùng, linh kiện xe. Trường hợp có nhu cầu điều chỉnh, thay thế liên quan đến nội thất, ngoại thất, hệ thống điện, kết cấu của xe thì Bên B phải gửi phương án kỹ thuật, thi công cho Bên A để Bên A thẩm định. Việc thi công chỉ được phép triển khai khi nhận được sự chấp thuận bằng văn bản của Bên A. Bên B cam kết chịu trách nhiệm và chi trả mọi chi phí phát sinh để sửa chữa xe hoặc khắc phục sự cố do các tác động hoặc can thiệp của Bên B vào xe mà không được sự chấp thuận của Bên A.</div>
                  <div className="ttds-line">Thực hiện đúng lịch bảo dưỡng, bảo trì theo hướng dẫn của nhà sản xuất hoặc theo yêu cầu của Bên A, bảo trì bảo dưỡng và sửa chữa xe tại các cơ sở bảo hành hoặc trạm dịch vụ của nhà sản xuất hoặc được sự ủy quyền của Bên A, sử dụng đúng danh mục vật tư, thiết bị mà nhà sản xuất khuyến cáo sử dụng xe và phải được sự đồng ý của Bên A. Trường hợp Bên B không thực hiện việc bảo dưỡng bảo trì theo thỏa thuận này, Bên A có quyền can thiệp đến vận hành của phương tiện và thu hồi phương tiện không được bảo dưỡng, bảo trì theo quy định.</div>
                  <div className="ttds-line">Bên B phải thực hiện giá cước theo quy định cho từng thời điểm của Bên A và chấp hành nghiêm chỉnh quy định pháp luật khi tham gia giao thông.</div>
                  <div className="ttds-line">4.2.13 Có quyền đề xuất thay đổi một số điều khoản của thỏa thuận này và Bên A sẽ xem xét.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 5: ĐIỀU KHOẢN CHUNG</strong></div>
                  <div className="ttds-line">Hai bên cam kết thực hiện đúng những điều khoản trong thỏa thuận này.</div>
                  <div className="ttds-line">Nếu xảy ra tranh chấp, hai bên sẽ giải quyết bằng thương lượng trên nguyên tắc tôn trọng quyền lợi của hai bên; nếu không thỏa mãn thì chuyển sự việc đến Tòa án dân sự để giải quyết, chi phí do bên có lỗi chịu.</div>
                </div>

                <div className="ttds-section">
                  <div className="ttds-line"><strong>ĐIỀU 6: HIỆU LỰC THỎA THUẬN</strong></div>
                  <div className="ttds-line">6.1 Thỏa thuận có hiệu lực {payload.thoiHanHieuLucText || '................................'}.</div>
                  <div className="ttds-line">Bên B đã được Bên A giải thích các nội dung trong thỏa thuận và hoàn toàn thống nhất, đồng thuận với các điều khoản trước khi ký và nhận bàn giao xe.</div>
                </div>

                {payload.ghiChu && (
                  <div className="ttds-section">
                    <div className="ttds-line"><strong>Ghi chú:</strong> {payload.ghiChu}</div>
                  </div>
                )}

                <table className="ttds-sign-table" aria-hidden="true">
                  <tbody>
                    <tr>
                      <td>
                        <div className="ttds-sign-title">Đại diện bên A</div>
                        <div className="ttds-sign-note">(Ký, ghi rõ họ tên)</div>
                      </td>
                      <td>
                        <div className="ttds-sign-title">Bên B</div>
                        <div className="ttds-sign-note">(Ký, ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr>
                      <td><div className="ttds-sign-space" /></td>
                      <td><div className="ttds-sign-space" /></td>
                    </tr>
                    <tr>
                      <td className="ttds-bold">{payload.daiDienBenA}</td>
                      <td className="ttds-bold">{payload.hoTenLaiXe}</td>
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

export default ThoaThuanDanSuPage;
