import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileSpreadsheet, Gauge, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildDeNghiKiemDinhTaximetExcelFileName,
  buildDeNghiKiemDinhTaximetExcelWorkbook,
  buildDeNghiKiemDinhTaximetPayload,
  fetchDeNghiKiemDinhTaximetBundleRelated,
  fetchDeNghiKiemDinhTaximetBundleRow,
  getDeNghiKiemDinhTaximetIdFromSearch
} from '../features/deNghiKiemDinhTaximet';

const previewStyles = `
  @page { size: A4 landscape; margin: 1.2cm; }
  .dnkdt-actions { print-color-adjust: exact; }
  .dnkdt-page { box-sizing: border-box; width: 29.7cm; min-height: 21cm; margin: 0 auto; padding: 1.2cm; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; }
  .dnkdt-title { margin: 0 0 12px; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .dnkdt-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 18px; margin-bottom: 12px; font-size: 12.5pt; }
  .dnkdt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .dnkdt-table th, .dnkdt-table td { border: 1px solid #000; padding: 5px 6px; vertical-align: middle; font-size: 12pt; }
  .dnkdt-table th { text-align: center; font-weight: 700; }
  .dnkdt-table td { text-align: center; }
  .dnkdt-table td.left { text-align: left; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .dnkdt-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .dnkdt-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải hồ sơ đề nghị kiểm định taximet. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải hồ sơ đề nghị kiểm định taximet. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

function VehicleTable({ payload }) {
  return (
    <table className="dnkdt-table">
      <thead>
        <tr>
          <th className="w-[8%]">STT</th>
          <th className="w-[32%]">Biển số</th>
          <th className="w-[24%]">Ngày hết hạn cũ</th>
          <th className="w-[36%]">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {payload.danhSachXe.length ? (
          payload.danhSachXe.map((item) => (
            <tr key={`${item.stt}-${item.bienSo || 'xe'}`}>
              <td>{item.stt}</td>
              <td>{item.bienSo}</td>
              <td>{item.ngayHetHanCu}</td>
              <td className="left">{item.ghiChu}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="left">Hồ sơ này chưa có xe đề nghị kiểm định taximet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const DeNghiKiemDinhTaximetPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idHoSoTaximet = useMemo(() => getDeNghiKiemDinhTaximetIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idHoSoTaximet);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [relatedWarning, setRelatedWarning] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idHoSoTaximet);
  }, [idHoSoTaximet]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idHoSoTaximet]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoTaximet trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_HoSoTaximet', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idHoSoTaximet) {
      setPayload(null);
      setErrorMessage('');
      setRelatedWarning('');
      setLoading(false);
      setLoadingRelated(false);
      return;
    }

    setLoading(true);
    setLoadingRelated(false);
    setRelatedWarning('');

    try {
      setErrorMessage('');
      const row = await fetchDeNghiKiemDinhTaximetBundleRow(idHoSoTaximet);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildDeNghiKiemDinhTaximetPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchDeNghiKiemDinhTaximetBundleRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildDeNghiKiemDinhTaximetPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        const message = `Đã tải hồ sơ chính nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`;
        toast.warning(message);
        setRelatedWarning(message);
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

  function openStandaloneHtml() {
    const nextId = (idHoSoTaximet || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoTaximet trước khi mở bản HTML.');
      return;
    }

    window.open(`/de_nghi_kiem_dinh_taximet_standalone.html?ID_HoSoTaximet=${encodeURIComponent(nextId)}`, '_blank');
  }

  async function exportToExcel() {
    if (!payload) return;
    if (!payload.danhSachXe.length) {
      toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    setExportingExcel(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([
        import('exceljs'),
        import('file-saver')
      ]);
      const workbook = await buildDeNghiKiemDinhTaximetExcelWorkbook(ExcelJS, payload);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const saveAs = fileSaver.saveAs || fileSaver.default;
      saveAs(blob, buildDeNghiKiemDinhTaximetExcelFileName(payload));
      toast.success('Đã xuất file Excel.');
    } catch (error) {
      toast.error(`Xuất Excel thất bại: ${error.message}`);
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <div className="space-y-6">
      <style>{previewStyles}</style>

      <Card className="dnkdt-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <Gauge className="h-6 w-6 text-red-700" />
                  Danh sách xe đề nghị kiểm định taximet
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idHoSoTaximet ? `Đã tải hồ sơ ${idHoSoTaximet}.` : 'Nhập ID_HoSoTaximet để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hồ sơ đề nghị kiểm định taximet"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_HoSoTaximet"
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
                In danh sách
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={exportToExcel} disabled={exportingExcel || loadingRelated || !payload}>
                {exportingExcel ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Xuất Excel
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!idHoSoTaximet && (
        <Card className="dnkdt-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hồ sơ để bắt đầu</CardTitle>
            <CardDescription>Điền ID_HoSoTaximet vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="dnkdt-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-red-700" />
              <div>
                <p className="font-semibold">Đang tải hồ sơ đề nghị kiểm định taximet</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="dnkdt-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được hồ sơ
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="dnkdt-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã tải hồ sơ chính, đang tải thêm thông tin đơn vị kiểm định và danh sách xe...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {relatedWarning && !loadingRelated && (
            <Card className="dnkdt-actions border-amber-200 bg-amber-50/80">
              <CardContent className="p-4 text-sm text-amber-900">{relatedWarning}</CardContent>
            </Card>
          )}

          {payload.soLuongXeChuaResolve > 0 && !loadingRelated && (
            <Card className="dnkdt-actions border-amber-200 bg-amber-50/80">
              <CardContent className="p-4 text-sm text-amber-900">
                Có {payload.soLuongXeChuaResolve} xe chưa resolve được từ bảng XE. Các dòng này sẽ để trống biển số thay vì hiển thị mã Ref.
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-3 shadow-sm">
            <article className="dnkdt-page">
              <h2 className="dnkdt-title">TÊN ĐƠN VỊ KIỂM ĐỊNH: {payload.tenDonViKiemDinh}</h2>
              <div className="dnkdt-meta">
                <div><strong>Số hồ sơ:</strong> {payload.soHoSo}</div>
                <div><strong>Ngày lập:</strong> {payload.ngayLapText}</div>
                <div><strong>Trạng thái:</strong> {payload.trangThaiHoSo}</div>
                <div><strong>Loại kiểm định:</strong> {payload.loaiKiemDinh}</div>
                <div><strong>Ngày kiểm định mới:</strong> {payload.ngayKiemDinhMoi}</div>
                <div><strong>Ngày hết hạn mới:</strong> {payload.ngayHetHanMoi}</div>
              </div>
              <VehicleTable payload={payload} />
            </article>
          </div>
        </>
      )}
    </div>
  );
};

export default DeNghiKiemDinhTaximetPage;
