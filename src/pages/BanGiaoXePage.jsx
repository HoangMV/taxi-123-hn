import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Car, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  buildBanGiaoXeTemplateData,
  buildBanGiaoXePayload,
  fetchBanGiaoXeNhanSu,
  fetchBanGiaoXeRow,
  getBanGiaoXeIdFromSearch
} from '../features/banGiaoXe';
import config from '../config/config';
import appSheetService from '../services/appSheetService';

const TEMPLATE_URL = '/ban_giao_xe_template.docx';

const previewStyles = `
  @page { size: A4; margin: 1.5cm; }
  .bgx-actions { print-color-adjust: exact; }
  .bgx-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.35; color: #000; }
  .bgx-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.5cm; background: #fff; border: 1px solid #cbd5e1; }
  .bgx-national { text-align: center; font-weight: 700; }
  .bgx-subtitle { text-align: center; font-weight: 700; text-decoration: underline; text-underline-offset: 5px; }
  .bgx-title { margin: 22px 0 8px; text-align: center; font-size: 18pt; font-weight: 700; }
  .bgx-row { margin: 8px 0; }
  .bgx-section-title { margin: 18px 0 8px; font-weight: 700; text-transform: uppercase; }
  .bgx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .bgx-label { font-weight: 700; }
  .bgx-check-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin-top: 8px; }
  .bgx-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 36px; text-align: center; font-weight: 700; }
  .bgx-sign-note { margin-top: 4px; font-weight: 400; font-style: italic; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .bgx-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .bgx-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

const identityItems = ['4 Mã đàm', 'SĐT xanh, trắng', 'Tem app', 'Tem mào, tròn, tem sườn', 'Bảng giá', 'Tem 10 điểm vàng'];
const equipmentItems = ['Lốp sơ cua', 'Kích lốp', 'Cầu trì ắc quy', 'Tay quay', 'Chụp ốc', 'Ốc giữ lốp'];
const paperItems = ['Đăng ký', 'Bảo hiểm', 'Chứng chỉ', 'Đăng kiểm', 'Phù hiệu taxi', 'Thẻ nhân viên, thẻ từ'];

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải biên bản bàn giao xe. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải biên bản bàn giao xe. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
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

function CheckList({ items }) {
  return (
    <div className="bgx-check-list">
      {items.map((item) => (
        <div key={item}>☐ {item}</div>
      ))}
    </div>
  );
}

const BanGiaoXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idBienBanXe = useMemo(() => getBanGiaoXeIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idBienBanXe);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingNhanSu, setLoadingNhanSu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idBienBanXe);
  }, [idBienBanXe]);

  useEffect(() => {
    loadData();
    // ID_BienBanXe thay đổi thì cần nạp lại đúng biên bản.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBienBanXe]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID biên bản trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_BienBanXe', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idBienBanXe) {
      setPayload(null);
      setErrorMessage('');
      setLoading(false);
      setLoadingNhanSu(false);
      return;
    }

    setLoading(true);
    setLoadingNhanSu(false);
    try {
      setErrorMessage('');
      const row = await fetchBanGiaoXeRow(appSheetService, idBienBanXe);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildBanGiaoXePayload(row));
      setLoading(false);
      setLoadingNhanSu(true);

      try {
        const nhanSuById = await fetchBanGiaoXeNhanSu(appSheetService, row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildBanGiaoXePayload(row, { nhanSuById }));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải biên bản nhưng chưa tải được thông tin nhân sự: ${getFriendlyError(relatedError)}`);
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoadingNhanSu(false);
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
      const zip = new PizZip(templateContent);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });

      doc.render(buildBanGiaoXeTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Ban_giao_xe_${payload.soBienBan || payload.idBienBanXe || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idBienBanXe || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID biên bản trước khi mở bản HTML.');
      return;
    }

    window.open(`/ban_giao_xe_standalone.html?ID_BienBanXe=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="bgx-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <Car className="h-6 w-6 text-red-700" />
                  Bàn giao xe
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idBienBanXe ? `Đã tải biên bản ${idBienBanXe}.` : 'Nhập ID_BienBanXe để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID biên bản bàn giao xe"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_BienBanXe"
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
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={exporting || loadingNhanSu || !payload}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idBienBanXe && (
        <Card className="bgx-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID biên bản để bắt đầu</CardTitle>
            <CardDescription>Điền ID_BienBanXe vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="bgx-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-red-700" />
              <div>
                <p className="font-semibold">Đang tải biên bản bàn giao xe</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="bgx-actions border-amber-200 bg-amber-50/80">
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
          <Card className="bgx-actions border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Thông tin đã tải</CardTitle>
              <CardDescription>Kiểm tra nhanh dữ liệu trước khi xuất Word.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Số biên bản" value={payload.soBienBan} />
              <InfoItem label="Ngày bàn giao" value={payload.ngayBanGiaoText} />
              <InfoItem label="Nhân sự" value={loadingNhanSu ? 'Đang tải tên nhân sự...' : 'Đã tải'} />
              <InfoItem label="Bên giao" value={payload.tenBenGiao} />
              <InfoItem label="Bên nhận" value={payload.hoTenLaiXe} />
              <InfoItem label="Biển số xe" value={payload.bienSoXe} />
              <InfoItem label="Mã đàm" value={payload.maDam} />
              <InfoItem label="Trạng thái xe" value={payload.trangThaiQuanLyXe} />
            </CardContent>
          </Card>

          <div className="overflow-x-auto pb-4">
            <div className="bgx-document min-w-[21cm]">
              <div className="bgx-page shadow-sm">
                <div className="bgx-national">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="bgx-subtitle">Độc lập - Tự do - Hạnh phúc</div>

                <div className="bgx-title">BIÊN BẢN BÀN GIAO XE</div>
                <div className="bgx-row">
                  <span className="bgx-label">Số biên bản:</span> {payload.soBienBan}
                </div>
                <div className="bgx-row">
                  Hôm nay, ngày {payload.ngayBanGiao.day || '...'} tháng {payload.ngayBanGiao.month || '...'} năm {payload.ngayBanGiao.year || '...'}
                </div>

                <div className="bgx-section-title">Chúng tôi gồm có:</div>
                <div className="bgx-row">
                  <span className="bgx-label">Bên giao:</span> {payload.tenBenGiao}
                </div>
                <div className="bgx-row">
                  Đại diện: 1. Ông/Bà {payload.daiDienBenGiao1} - {payload.chucVuBenGiao1}
                </div>
                <div className="bgx-row">
                  2. Ông/Bà {payload.daiDienBenGiao2} - {payload.chucVuBenGiao2}
                </div>
                <div className="bgx-row">
                  <span className="bgx-label">Bên nhận:</span> Ông/Bà {payload.hoTenLaiXe}
                </div>
                <div className="bgx-grid">
                  <div>Số CCCD: {payload.soCccd}</div>
                  <div>Số GPLX: {payload.soGplx}</div>
                  <div>Hạn GPLX: {payload.hanGplx}</div>
                </div>

                <div className="bgx-row">
                  Cùng tiến hành bàn giao phương tiện và xác nhận các trang, thiết bị, giấy tờ kèm theo phương tiện như sau:
                </div>

                <div className="bgx-section-title">I. Thông tin phương tiện</div>
                <div className="bgx-grid">
                  <div>- Biển kiểm soát: {payload.bienSoXe}</div>
                  <div>- Mã đàm: {payload.maDam}</div>
                  <div>- Số khung: {payload.soKhung}</div>
                  <div>- Số máy: {payload.soMay}</div>
                  <div>- Nhãn hiệu: {payload.nhanHieuXe}</div>
                  <div>- Năm sản xuất: {payload.namSanXuat}</div>
                </div>

                <div className="bgx-section-title">II. Nhận diện thương hiệu</div>
                <CheckList items={identityItems} />

                <div className="bgx-section-title">III. Trang, thiết bị, giấy tờ</div>
                <div className="bgx-row">
                  <span className="bgx-label">1. Thiết bị đồng hồ taximet</span>
                </div>
                <div className="bgx-grid">
                  <div>Loại đồng hồ: ☐ HP ☐ Penten X</div>
                  <div>Cài giá: ☐ 5 chỗ ☐ 7 chỗ ☐ 8 chỗ</div>
                  <div>Loa khách trên xe: ☐ Không nghe thấy ☐ Đúng, nghe rõ</div>
                  <div>Loa xuống xe: ☐ Không nghe thấy ☐ Đúng, nghe rõ</div>
                  <div>Niêm phong hộp đồng hồ: ☐ Đã có, không rách</div>
                  <div>Lời chào: ☐ Đã cài đặt đủ nội dung ☐ Chưa cài đặt</div>
                </div>

                <div className="bgx-row">
                  <span className="bgx-label">2. Bộ đàm</span> - Số mã đàm: {payload.maDam}
                </div>
                <div className="bgx-row">☐ Đúng mã đàm ☐ Kênh 1 ☐ Kênh 3 ☐ Trung tâm xác nhận rõ xe</div>

                <div className="bgx-row">
                  <span className="bgx-label">3. Trang bị kèm theo</span>
                </div>
                <CheckList items={equipmentItems} />

                <div className="bgx-row">
                  <span className="bgx-label">4. Giấy tờ xe và lái xe</span>
                </div>
                <CheckList items={paperItems} />

                <div className="bgx-signatures">
                  <div>
                    ĐẠI DIỆN BÊN GIAO
                    <div className="bgx-sign-note">(Ký và ghi rõ họ tên)</div>
                  </div>
                  <div>
                    BAN THANH TRA
                    <div className="bgx-sign-note">(Ký và ghi rõ họ tên)</div>
                  </div>
                  <div>
                    ĐẠI DIỆN BÊN NHẬN
                    <div className="bgx-sign-note">(Ký và ghi rõ họ tên)</div>
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

export default BanGiaoXePage;
