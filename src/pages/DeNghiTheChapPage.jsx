import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileSpreadsheet, Landmark, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildDeNghiTheChapExcelFileName,
  buildDeNghiTheChapExcelWorkbook,
  buildDeNghiTheChapPayload,
  fetchDeNghiTheChapBundleDetails,
  fetchDeNghiTheChapBundleRow,
  fetchDeNghiTheChapBundleVisibleRefs,
  getDeNghiTheChapIdFromSearch
} from '../features/deNghiTheChap';

const previewStyles = `
  @page { size: A4 landscape; margin: 1.2cm; }
  .dntc-actions { print-color-adjust: exact; }
  .dntc-page { box-sizing: border-box; width: 29.7cm; min-height: 21cm; margin: 0 auto; padding: 0.7cm; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 9.5pt; line-height: 1.2; }
  .dntc-title { margin: 0 0 10px; font-size: 14pt; font-weight: 700; text-align: center; text-transform: uppercase; }
  .dntc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .dntc-table th, .dntc-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8.5pt; }
  .dntc-table th { background: #ffff00; text-align: center; font-weight: 700; }
  .dntc-table td { text-align: center; }
  .dntc-table td.left { text-align: left; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .dntc-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .dntc-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải hồ sơ đề nghị thế chấp. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'Google Sheets trả về lỗi khi tải hồ sơ đề nghị thế chấp. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

function VehicleTable({ payload }) {
  return (
    <table className="dntc-table">
      <thead>
        <tr>
          <th style={{ width: '2.7%' }}>STT</th>
          <th style={{ width: '4.6%' }}>BIỂN SỐ</th>
          <th style={{ width: '3.5%' }}>MÃ ĐÀM</th>
          <th style={{ width: '9.2%' }}>TRẠNG THÁI KHOAN VAY</th>
          <th style={{ width: '5.3%' }}>THỜI HẠN</th>
          <th style={{ width: '5.7%' }}>SỐ ĐĂNG KÝ</th>
          <th style={{ width: '8.3%' }}>SỐ KHUNG</th>
          <th style={{ width: '7.2%' }}>SỐ MÁY</th>
          <th style={{ width: '7.7%' }}>NHÃN HIỆU</th>
          <th style={{ width: '3.9%' }}>NĂM SX</th>
          <th style={{ width: '3.5%' }}>SỐ CHỖ</th>
          <th style={{ width: '4.8%' }}>NƯỚC SX</th>
          <th style={{ width: '7.2%' }}>NGÀY ĐĂNG KÝ XE LẦN ĐẦU</th>
          <th style={{ width: '13.1%' }}>TÊN ĐĂNG KÝ XE</th>
          <th style={{ width: '13.1%' }}>GHI CHÚ</th>
        </tr>
      </thead>
      <tbody>
        {payload.danhSachXe.length ? (
          payload.danhSachXe.map((item) => (
            <tr key={`${item.stt}-${item.bienSo || 'xe'}`}>
              <td>{item.stt}</td>
              <td>{item.bienSo}</td>
              <td>{item.maDam}</td>
              <td>{item.trangThaiKhoanVay}</td>
              <td>{item.thoiHan}</td>
              <td>{item.soDangKy}</td>
              <td className="left">{item.soKhung}</td>
              <td className="left">{item.soMay}</td>
              <td className="left">{item.nhanHieu}</td>
              <td>{item.namSanXuat}</td>
              <td>{item.soCho}</td>
              <td>{item.nuocSanXuat}</td>
              <td>{item.ngayDangKyLanDau}</td>
              <td className="left">{item.tenDangKyXe}</td>
              <td className="left">{item.ghiChu}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={15} className="left">Hồ sơ này chưa có xe đề nghị thế chấp.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const DeNghiTheChapPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idHoSoTheChap = useMemo(() => getDeNghiTheChapIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idHoSoTheChap);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [relatedWarning, setRelatedWarning] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idHoSoTheChap);
  }, [idHoSoTheChap]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idHoSoTheChap]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoTheChap trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_HoSoTheChap', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idHoSoTheChap) {
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
      const row = await fetchDeNghiTheChapBundleRow(idHoSoTheChap);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildDeNghiTheChapPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const details = await fetchDeNghiTheChapBundleDetails(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildDeNghiTheChapPayload(row, details));

        const related = await fetchDeNghiTheChapBundleVisibleRefs(row, details.chiTietRows);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildDeNghiTheChapPayload(row, related));
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
    const nextId = (idHoSoTheChap || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoTheChap trước khi mở bản HTML.');
      return;
    }

    window.open(`/de_nghi_the_chap_standalone.html?ID_HoSoTheChap=${encodeURIComponent(nextId)}`, '_blank');
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
      const workbook = await buildDeNghiTheChapExcelWorkbook(ExcelJS, payload);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const saveAs = fileSaver.saveAs || fileSaver.default;
      saveAs(blob, buildDeNghiTheChapExcelFileName(payload));
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

      <Card className="dntc-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <Landmark className="h-6 w-6 text-red-700" />
                  Danh sách xe đề nghị thế chấp
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idHoSoTheChap ? `Đã tải hồ sơ ${idHoSoTheChap}.` : 'Nhập ID_HoSoTheChap để tải dữ liệu từ Google Sheets.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hồ sơ đề nghị thế chấp"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_HoSoTheChap"
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

      {!idHoSoTheChap && (
        <Card className="dntc-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hồ sơ để bắt đầu</CardTitle>
            <CardDescription>Điền ID_HoSoTheChap vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="dntc-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-red-700" />
              <div>
                <p className="font-semibold">Đang tải hồ sơ đề nghị thế chấp</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ Google Sheets, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="dntc-actions border-amber-200 bg-amber-50/80">
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
            <Card className="dntc-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đang tải thêm thông tin xe và trạng thái khoản vay...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {relatedWarning && !loadingRelated && (
            <Card className="dntc-actions border-amber-200 bg-amber-50/80">
              <CardContent className="p-4 text-sm text-amber-900">{relatedWarning}</CardContent>
            </Card>
          )}
          {payload.soLuongXeChuaResolve > 0 && !loadingRelated && (
            <Card className="dntc-actions border-amber-200 bg-amber-50/80">
              <CardContent className="p-4 text-sm text-amber-900">
                Có {payload.soLuongXeChuaResolve} xe chưa resolve được từ bảng XE. Các dòng này sẽ để trống biển số thay vì hiển thị mã Ref.
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-3 shadow-sm">
            <article className="dntc-page">
              <h2 className="dntc-title">{payload.tieuDeBaoCao}</h2>
              <VehicleTable payload={payload} />
            </article>
          </div>
        </>
      )}
    </div>
  );
};

export default DeNghiTheChapPage;
