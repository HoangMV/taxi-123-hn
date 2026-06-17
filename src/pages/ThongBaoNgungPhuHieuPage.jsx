import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, IdCard, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildThongBaoNgungPayload,
  buildThongBaoNgungTemplateData,
  fetchThongBaoNgungRelated,
  fetchThongBaoNgungRow,
  getThongBaoNgungIdFromSearch
} from '../features/thongBaoNgungPhuHieu';

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
  .tbnp-actions { print-color-adjust: exact; }
  .tbnp-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.4cm 1.5cm 1.6cm; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; }
  .tbnp-header { display: grid; grid-template-columns: .9fr 1.1fr; gap: 18px; }
  .tbnp-center { text-align: center; }
  .tbnp-bold { font-weight: 700; }
  .tbnp-underlined { display: inline-block; border-bottom: 1px solid #000; padding: 0 8px 2px; }
  .tbnp-meta { margin-top: 10px; }
  .tbnp-title { margin: 20px 0 10px; text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .tbnp-row { margin: 6px 0; text-align: justify; }
  .tbnp-indent { padding-left: 28px; }
  .tbnp-table { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; }
  .tbnp-table th, .tbnp-table td { border: 1px solid #000; padding: 4px 4px; vertical-align: middle; font-size: 12pt; }
  .tbnp-table th { text-align: center; font-weight: 700; }
  .tbnp-table td { text-align: center; }
  .tbnp-table td.left { text-align: left; }
  .tbnp-sign { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .tbnp-sign-right { text-align: center; }
  .tbnp-sign-space { height: 92px; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .tbnp-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .tbnp-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải thông báo ngừng phù hiệu. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 180) {
    return 'Google Sheets trả về lỗi khi tải thông báo ngừng phù hiệu. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

function renderValue(value, fallback = '........................................................') {
  return value || fallback;
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 min-h-5 break-words text-sm text-slate-950">{value || 'Chưa có'}</div>
    </div>
  );
}

function VehicleTable({ payload }) {
  return (
    <table className="tbnp-table">
      <thead>
        <tr>
          <th className="w-[7%]">STT</th>
          <th className="w-[15%]">Biển kiểm soát</th>
          <th className="w-[18%]">Số phù hiệu</th>
          <th className="w-[14%]">Hạn phù hiệu</th>
          <th className="w-[28%]">Đơn vị</th>
          <th className="w-[18%]">Lý do</th>
        </tr>
      </thead>
      <tbody>
        {payload.danhSachXe.length ? (
          payload.danhSachXe.map((item) => (
            <tr key={`${item.stt}-${item.bienSo}-${item.soPhuHieu}`}>
              <td>{item.stt}</td>
              <td>{item.bienSo}</td>
              <td>{item.soPhuHieu}</td>
              <td>{item.hanPhuHieu}</td>
              <td className="left">{item.donVi}</td>
              <td className="left">{item.lyDo}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="left">Chưa có xe trong thông báo ngừng phù hiệu này.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function DocumentPreview({ payload }) {
  const isVinhPhuc = payload.templateConfig?.maDonVi === '0104163591-001';

  return (
    <div className="tbnp-page shadow-sm">
      <div className="tbnp-header">
        <div className="tbnp-center tbnp-bold">
          {isVinhPhuc ? (
            <>
              <div>CÔNG TY CPVT HOÀNG MINH DŨNG</div>
              <div>CHI NHÁNH VĨNH PHÚC</div>
            </>
          ) : (
            <>
              <div>CÔNG TY CỔ PHẦN VẬN TẢI</div>
              <div>HOÀNG MINH DŨNG</div>
            </>
          )}
          <div className="tbnp-meta">Số: {renderValue(payload.soThongBao, '......../2026/CV-SXD')}</div>
        </div>
        <div className="tbnp-center">
          <div className="tbnp-bold">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="tbnp-bold tbnp-underlined">Độc lập - Tự do - Hạnh phúc</div>
          <div className="tbnp-meta">
            <em>{payload.diaDanhLapThongBao || '........'}, ngày {renderValue(payload.ngayThongBao.day, '....')} tháng {renderValue(payload.ngayThongBao.month, '....')} năm {renderValue(payload.ngayThongBao.year, '20....')}</em>
          </div>
        </div>
      </div>

      <div className="tbnp-title">Giấy đề nghị hủy phù hiệu, biển hiệu</div>
      <div className="tbnp-row tbnp-center">Kính gửi: {renderValue(payload.coQuanNhanThongBao)}</div>
      <div className="tbnp-row">Tên doanh nghiệp vận tải: {renderValue(payload.tenDonVi)}</div>
      <div className="tbnp-row">Địa chỉ trụ sở doanh nghiệp: {renderValue(payload.diaChiDonVi)}</div>
      <div className="tbnp-row">Số điện thoại: {renderValue(payload.soDienThoai)}</div>

      {isVinhPhuc ? (
        <div className="tbnp-row">Giấy Số phép kinh doanh vận tải bằng xe ô tô số 26210009/GPKDVT cấp lần thứ 4 ngày 19 tháng 11 năm 2021 do Sở Giao Thông Vận Tải tỉnh Vĩnh Phúc cấp.</div>
      ) : (
        <div className="tbnp-row">Giấy Số phép kinh doanh vận tải bằng xe ô tô số 100/GPKDVT cấp lần thứ 6 ngày 06 tháng 05 năm 2025 do Sở Xây dựng Hà Nội cấp.</div>
      )}

      <div className="tbnp-row">
        {isVinhPhuc
          ? `5. Số lượng xe đề nghị hủy phù hiệu: ${payload.soLuongXeText} xe, danh sách xe như sau:`
          : `5. Số lượng xe xin tạm ngừng kinh doanh taxi: ${payload.soLuongXeText} xe, danh sách xe như sau:`}
      </div>
      <VehicleTable payload={payload} />
      <div className="tbnp-row">
        {isVinhPhuc
          ? `- Số lượng phù hiệu, biển hiệu nộp lại: ${payload.soLuongXeText} phù hiệu.`
          : `- Số lượng phù hiệu nộp lại: ${payload.soLuongXeText} phù hiệu.`}
      </div>

      {isVinhPhuc ? (
        <>
          <div className="tbnp-row">6. Thông tin về tài khoản giám sát hành trình:</div>
          <div className="tbnp-row tbnp-indent">Trang web nhà cung cấp dịch vụ: https://taxi.binhanhcorp.com/</div>
          <div className="tbnp-row tbnp-indent">Tài khoản đăng nhập: xe123taxi</div>
          <div className="tbnp-row tbnp-indent">Mật khẩu: 123456</div>
        </>
      ) : (
        <div className="tbnp-row">6. Hiện nay {renderValue(payload.tenDonVi)} thu hồi {payload.soLuongXeText} phù hiệu “{payload.loaiPhuHieu}” nộp lại Sở giao thông và xin bảo lưu số phù hiệu trên chờ thay thế.</div>
      )}

      <div className="tbnp-row">Chúng tôi xin cam kết những thông tin cung cấp trên đây là hoàn toàn chính xác. Nếu sai chúng tôi xin hoàn toàn chịu trách nhiệm trước pháp luật.</div>

      <div className="tbnp-sign">
        <div>
          <div className="tbnp-bold"><em>Nơi nhận:</em></div>
          <div><em>- Như trên;</em></div>
          <div><em>- Lưu.</em></div>
        </div>
        <div className="tbnp-sign-right">
          <div className="tbnp-bold">ĐẠI DIỆN DOANH NGHIỆP</div>
          <div><em>(Ký tên, đóng dấu)</em></div>
          <div className="tbnp-sign-space" />
        </div>
      </div>

      <div className="tbnp-center">
        Xác nhận của {isVinhPhuc ? 'Sở Xây dựng tỉnh Phú Thọ' : 'Sở Xây dựng TP Hà Nội'}
        <br />
        Ngày…… tháng…… năm ………
      </div>
    </div>
  );
}

const ThongBaoNgungPhuHieuPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idThongBaoNgung = useMemo(() => getThongBaoNgungIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idThongBaoNgung);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idThongBaoNgung);
  }, [idThongBaoNgung]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idThongBaoNgung]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThongBaoNgung trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_ThongBaoNgung', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idThongBaoNgung) {
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
      const row = await fetchThongBaoNgungRow(idThongBaoNgung);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildThongBaoNgungPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchThongBaoNgungRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildThongBaoNgungPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        toast.warning(`Đã tải thông báo nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`);
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

    if (!payload.templateConfig) {
      toast.error(`Chưa có mẫu Word cho MaDonVi = ${payload.maDonVi || 'trống'}.`);
      return;
    }

    setExporting(true);
    try {
      const response = await fetch(payload.templateConfig.templateUrl);
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

      doc.render(buildThongBaoNgungTemplateData(payload));

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const fileId = payload.soThongBao || payload.idThongBaoNgung || 'new';
      saveAs(blob, `Thong_bao_ngung_phu_hieu_${fileId.replace(/[\\/:*?"<>|]/g, '_')}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  function openStandaloneHtml() {
    const nextId = (idThongBaoNgung || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_ThongBaoNgung trước khi mở bản HTML.');
      return;
    }

    window.open(`/thong_bao_ngung_phu_hieu_standalone.html?ID_ThongBaoNgung=${encodeURIComponent(nextId)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="tbnp-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <IdCard className="h-6 w-6 text-red-700" />
                  Thông báo ngừng phù hiệu
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idThongBaoNgung ? `Đã tải thông báo ${idThongBaoNgung}.` : 'Nhập ID_ThongBaoNgung để tải dữ liệu từ Google Sheets.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                value={idInput}
                onChange={(event) => setIdInput(event.target.value)}
                aria-label="ID thông báo ngừng phù hiệu"
                placeholder="Nhập ID_ThongBaoNgung"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading || loadingRelated ? 'animate-spin' : ''}`} />
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
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={!payload || exporting || loadingRelated}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idThongBaoNgung && (
        <Card className="tbnp-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID thông báo để bắt đầu</CardTitle>
            <CardDescription>Điền ID_ThongBaoNgung vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && idThongBaoNgung && (
        <Card className="tbnp-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-red-700" />
              <div>
                <p className="font-semibold">Đang tải thông báo ngừng phù hiệu</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ Google Sheets, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="tbnp-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được thông báo
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <Card className="tbnp-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Thông tin đã tải</CardTitle>
            <CardDescription>Kiểm tra nhanh dữ liệu trước khi xuất Word.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Mẫu Word" value={payload.templateLabel || 'Chưa hỗ trợ'} />
            <InfoItem label="Mã đơn vị" value={payload.maDonVi || 'Trống'} />
            <InfoItem label="Số xe" value={payload.soLuongXeText} />
            <InfoItem label="Ngày thông báo" value={payload.ngayThongBaoText || 'Trống'} />
          </CardContent>
        </Card>
      )}

      {payload && !payload.templateConfig && (
        <Card className="tbnp-actions border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-5 text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>Chưa có template Word cho MaDonVi = {payload.maDonVi || 'trống'}. Hiện chỉ hỗ trợ 0104163591 và 0104163591-001.</div>
          </CardContent>
        </Card>
      )}

      {payload && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
          <DocumentPreview payload={payload} />
        </div>
      )}
    </div>
  );
};

export default ThongBaoNgungPhuHieuPage;
