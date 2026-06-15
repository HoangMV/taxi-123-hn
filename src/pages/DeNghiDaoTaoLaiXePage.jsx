import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, FileSpreadsheet, GraduationCap, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildDeNghiDaoTaoExcelFileName,
  buildDeNghiDaoTaoExcelWorkbook,
  buildDeNghiDaoTaoPayload,
  fetchDeNghiDaoTaoBundleRelated,
  fetchDeNghiDaoTaoBundleRow,
  getDeNghiDaoTaoIdFromSearch
} from '../features/deNghiDaoTaoLaiXe';

const previewStyles = `
  @page { size: A4 landscape; margin: 1.2cm; }
  .dndtlx-actions { print-color-adjust: exact; }
  .dndtlx-page { box-sizing: border-box; width: 29.7cm; min-height: 21cm; margin: 0 auto; padding: 1.2cm; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; }
  .dndtlx-title { margin: 0 0 12px; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
  .dndtlx-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 18px; margin-bottom: 12px; font-size: 12.5pt; }
  .dndtlx-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .dndtlx-table th, .dndtlx-table td { border: 1px solid #000; padding: 5px 6px; vertical-align: middle; font-size: 12pt; }
  .dndtlx-table th { text-align: center; font-weight: 700; }
  .dndtlx-table td { text-align: center; }
  .dndtlx-table td.left { text-align: left; }
  @media print {
    html, body, #root { width: auto !important; height: auto !important; overflow: visible !important; background: #fff !important; }
    aside, header, .dndtlx-actions { display: none !important; }
    main { padding: 0 !important; }
    .app-print-root, .app-print-frame, .app-print-content, .app-print-main { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    .dndtlx-page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
  }
`;

function getFriendlyError(error) {
  const message = error?.message || '';
  if (!message) return 'Không thể tải hồ sơ đề nghị đào tạo. Vui lòng thử lại.';
  if (message.includes('Thiếu tham số') || message.includes('Không tìm thấy') || message.includes('Thiếu cấu hình')) return message;
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }
  if (message.length > 160) {
    return 'AppSheet trả về lỗi khi tải hồ sơ đề nghị đào tạo. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }
  return message;
}

function DriverTable({ payload }) {
  return (
    <table className="dndtlx-table">
      <thead>
        <tr>
          <th className="w-[6%]">STT</th>
          <th className="w-[18%]">Họ và tên</th>
          <th className="w-[12%]">Ngày sinh</th>
          <th className="w-[30%]">Địa chỉ</th>
          <th className="w-[14%]">Số CCCD</th>
          <th className="w-[12%]">Ngày cấp CCCD</th>
          <th className="w-[8%]">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {payload.danhSachLaiXe.length ? (
          payload.danhSachLaiXe.map((item) => (
            <tr key={`${item.stt}-${item.refNhanSu || item.hoTen}`}>
              <td>{item.stt}</td>
              <td className="left">{item.hoTen}</td>
              <td>{item.ngaySinh}</td>
              <td className="left">{item.diaChi}</td>
              <td>{item.soCccd}</td>
              <td>{item.ngayCapCccd}</td>
              <td className="left">{item.ghiChu}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7} className="left">Hồ sơ này chưa có lái xe đề nghị đào tạo.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

const DeNghiDaoTaoLaiXePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const idHoSoDaoTao = useMemo(() => getDeNghiDaoTaoIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idHoSoDaoTao);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    setIdInput(idHoSoDaoTao);
  }, [idHoSoDaoTao]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idHoSoDaoTao]);

  function submitId(event) {
    event.preventDefault();
    const nextId = idInput.trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoDaoTao trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set('ID_HoSoDaoTao', nextId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  async function loadData() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!idHoSoDaoTao) {
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
      const row = await fetchDeNghiDaoTaoBundleRow(idHoSoDaoTao);
      if (loadRequestIdRef.current !== requestId) return;

      setPayload(buildDeNghiDaoTaoPayload(row));
      setLoading(false);
      setLoadingRelated(true);

      try {
        const related = await fetchDeNghiDaoTaoBundleRelated(row);
        if (loadRequestIdRef.current !== requestId) return;
        setPayload(buildDeNghiDaoTaoPayload(row, related));
      } catch (relatedError) {
        if (loadRequestIdRef.current !== requestId) return;
        const message = `Đã tải hồ sơ nhưng chưa tải được dữ liệu liên kết: ${getFriendlyError(relatedError)}`;
        toast.warning(message);
        setErrorMessage(message);
        setPayload(null);
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
    const nextId = (idHoSoDaoTao || idInput).trim();

    if (!nextId) {
      toast.warning('Vui lòng nhập ID_HoSoDaoTao trước khi mở bản HTML.');
      return;
    }

    window.open(`/de_nghi_dao_tao_lai_xe_standalone.html?ID_HoSoDaoTao=${encodeURIComponent(nextId)}`, '_blank');
  }

  async function exportToExcel() {
    if (!payload) return;
    if (!payload.danhSachLaiXe.length) {
      toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    setExportingExcel(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([
        import('exceljs'),
        import('file-saver')
      ]);
      const workbook = await buildDeNghiDaoTaoExcelWorkbook(ExcelJS, payload);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const saveAs = fileSaver.saveAs || fileSaver.default;
      saveAs(blob, buildDeNghiDaoTaoExcelFileName(payload));
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

      <Card className="dndtlx-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  <GraduationCap className="h-6 w-6 text-red-700" />
                  Danh sách lái xe đề nghị đào tạo
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {idHoSoDaoTao ? `Đã tải hồ sơ ${idHoSoDaoTao}.` : 'Nhập ID_HoSoDaoTao để tải dữ liệu từ AppSheet.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitId}>
              <Input
                aria-label="ID hồ sơ đề nghị đào tạo"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập ID_HoSoDaoTao"
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

      {!idHoSoDaoTao && (
        <Card className="dndtlx-actions border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>Nhập ID hồ sơ để bắt đầu</CardTitle>
            <CardDescription>Điền ID_HoSoDaoTao vào ô phía trên rồi bấm “Tải dữ liệu”. Trang sẽ thêm ID vào URL để mở lại thuận tiện.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="dndtlx-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-red-700" />
              <div>
                <p className="font-semibold">Đang tải hồ sơ đề nghị đào tạo</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ AppSheet, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="dndtlx-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được hồ sơ
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loadingRelated && !loading && !payload && !errorMessage && (
        <Card className="dndtlx-actions border-slate-200 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
              <p className="text-sm">Đã tải hồ sơ chính, đang tải thêm thông tin đơn vị và danh sách lái xe...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {payload && !loading && (
        <>
          {loadingRelated && (
            <Card className="dndtlx-actions border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  <p className="text-sm">Đã tải hồ sơ chính, đang tải thêm thông tin đơn vị và lái xe...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {payload.soLuongChuaResolve > 0 && !loadingRelated && (
            <Card className="dndtlx-actions border-amber-200 bg-amber-50/80">
              <CardContent className="p-4 text-sm text-amber-900">
                Có {payload.soLuongChuaResolve} lái xe chưa resolve được từ bảng NHANSU. Các dòng này sẽ để trống thông tin cá nhân thay vì hiển thị mã Ref.
              </CardContent>
            </Card>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-3 shadow-sm">
            <article className="dndtlx-page">
              <h2 className="dndtlx-title">TÊN ĐƠN VỊ: {payload.tenDonVi}</h2>
              <div className="dndtlx-meta">
                <div><strong>Số hồ sơ:</strong> {payload.soHoSo}</div>
                <div><strong>Ngày lập:</strong> {payload.ngayLapText}</div>
                <div><strong>Trạng thái:</strong> {payload.trangThaiHoSo}</div>
                <div><strong>Nội dung đào tạo:</strong> {payload.noiDungDaoTao}</div>
                <div><strong>Khóa đào tạo:</strong> {payload.tenKhoaDaoTao}</div>
                <div><strong>Số lái xe:</strong> {payload.soLuongLaiXe}</div>
              </div>
              <DriverTable payload={payload} />
            </article>
          </div>
        </>
      )}
    </div>
  );
};

export default DeNghiDaoTaoLaiXePage;
