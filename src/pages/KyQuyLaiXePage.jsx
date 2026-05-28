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
  .kq-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.4; color: #000; }
  .kq-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.5cm; background: #fff; border: 1px solid #cbd5e1; }
  .kq-center { text-align: center; }
  .kq-bold { font-weight: 700; }
  .kq-title { margin: 20px 0 10px; text-align: center; font-size: 18pt; font-weight: 700; }
  .kq-row { margin: 8px 0; }
  .kq-grid { display: grid; grid-template-columns: 180px 1fr; gap: 6px 18px; }
  .kq-section-title { margin: 18px 0 8px; font-weight: 700; text-transform: uppercase; }
  .kq-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; text-align: center; font-weight: 700; }
  .kq-sign-note { margin-top: 4px; font-weight: 400; font-style: italic; }
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

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 min-h-5 break-words text-sm text-slate-950">{value || 'Chưa có'}</div>
    </div>
  );
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
                <form className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]" onSubmit={submitId}>
                  <Input
                    aria-label="ID hợp đồng ký quỹ"
                    className="h-10 rounded-xl"
                    placeholder="Nhập ID_KyQuy"
                    value={idInput}
                    onChange={(event) => setIdInput(event.target.value)}
                  />
                  <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Tải dữ liệu
                  </Button>
                </form>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 xl:grid-cols-4">
              <Button variant="outline" className="w-full" onClick={openStandaloneHtml}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở bản HTML
              </Button>
              <Button variant="outline" className="w-full" onClick={() => window.print()} disabled={!payload}>
                <Printer className="mr-2 h-4 w-4" />
                In tài liệu
              </Button>
              <Button className="w-full" onClick={exportToWordTemplate} disabled={exporting || loading || !payload}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
              <Button variant="outline" className="w-full" onClick={loadData} disabled={loading || !idKyQuy}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Tải lại
              </Button>
            </div>
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
          <Card className="kq-actions border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Thông tin đã tải</CardTitle>
              <CardDescription>Kiểm tra nhanh dữ liệu đã resolve trước khi in hoặc xuất Word.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Số hợp đồng" value={payload.soHopDong} />
              <InfoItem label="Ngày ký" value={payload.ngayKyText} />
              <InfoItem label="Lái xe" value={payload.hoTenLaiXe} />
              <InfoItem label="Đơn vị" value={payload.tenDonVi} />
              <InfoItem label="CCCD" value={payload.soCccd} />
              <InfoItem label="Số tiền phải nộp" value={payload.soTienPhaiNopText} />
              <InfoItem label="Đã nộp" value={payload.soTienDaNopText} />
              <InfoItem label="Còn lại" value={payload.soTienConLaiText} />
            </CardContent>
          </Card>

          <div className="overflow-x-auto pb-4">
            <div className="kq-document min-w-[21cm]">
              <div className="kq-page shadow-sm">
                <div className="kq-center kq-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="kq-center kq-bold">Độc lập - Tự do - Hạnh phúc</div>
                <div className="kq-center kq-bold">-----o0o-----</div>

                <div className="kq-title">HỢP ĐỒNG ĐẶT CỌC ĐẢM BẢO TRÁCH NHIỆM TÀI SẢN</div>
                <div className="kq-center kq-bold">Số: {payload.soHopDong}</div>

                <div className="kq-row">
                  Hôm nay, ngày {payload.ngayKy.day || '...'} tháng {payload.ngayKy.month || '...'} năm {payload.ngayKy.year || '...'},
                  chúng tôi gồm:
                </div>

                <div className="kq-section-title">Bên A - Bên nhận cọc</div>
                <div className="kq-grid">
                  <div>Tên đơn vị</div>
                  <div>: {payload.tenDonVi}</div>
                  <div>Địa chỉ</div>
                  <div>: {payload.diaChiDonVi}</div>
                  <div>Mã số thuế</div>
                  <div>: {payload.maSoThueDonVi}</div>
                  <div>Đại diện</div>
                  <div>: {payload.nguoiDaiDienDonVi}{payload.chucVuNguoiDaiDien ? ` - ${payload.chucVuNguoiDaiDien}` : ''}</div>
                </div>

                <div className="kq-section-title">Bên B - Bên đặt cọc</div>
                <div className="kq-grid">
                  <div>Họ và tên</div>
                  <div>: {payload.hoTenLaiXe}</div>
                  <div>Địa chỉ</div>
                  <div>: {payload.diaChiDayDu}</div>
                  <div>CCCD</div>
                  <div>: {payload.soCccd}</div>
                  <div>Ngày cấp</div>
                  <div>: {payload.ngayCapCccd}</div>
                  <div>Nơi cấp</div>
                  <div>: {payload.noiCapCccd}</div>
                  <div>Số điện thoại</div>
                  <div>: {payload.soDienThoai}</div>
                </div>

                <div className="kq-row">
                  Sau khi thỏa thuận, hai Bên thống nhất ký Hợp đồng đặt cọc đảm bảo trách nhiệm tài sản với các điều khoản sau:
                </div>

                <div className="kq-section-title">Nội dung ký quỹ</div>
                <div className="kq-grid">
                  <div>Số tiền phải nộp</div>
                  <div>: {payload.soTienPhaiNopText} đồng ({payload.soTienPhaiNopBangChu} đồng)</div>
                  <div>Số tiền đã nộp</div>
                  <div>: {payload.soTienDaNopText} đồng</div>
                  <div>Số tiền còn lại</div>
                  <div>: {payload.soTienConLaiText} đồng</div>
                  <div>Trạng thái</div>
                  <div>: {payload.trangThaiKyQuy}</div>
                </div>

                <div className="kq-row">
                  Khoản ký quỹ này dùng để đảm bảo việc thực hiện các nghĩa vụ đã cam kết với đơn vị, bao gồm trách nhiệm quản lý,
                  sử dụng tài sản và các nghĩa vụ tài chính khác theo quy định nội bộ.
                </div>

                <div className="kq-signatures">
                  <div>
                    BÊN NHẬN CỌC
                    <div className="kq-sign-note">(Ký và đóng dấu)</div>
                  </div>
                  <div>
                    BÊN ĐẶT CỌC
                    <div className="kq-sign-note">(Ký và ghi rõ họ tên)</div>
                  </div>
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
