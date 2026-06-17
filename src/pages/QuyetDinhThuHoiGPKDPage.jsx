import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Printer, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import config from '../config/config';
import {
  buildCanCuList,
  buildLyDoThuHoi,
  fetchQuyetDinhThuHoiData,
  formatAdministrativeDate,
  formatAdministrativeDateString,
  getDecisionIdFromSearch,
  getNguoiKyName,
  normalizeQuyetDinhWordLayout
} from '../features/quyetDinhThuHoiGPKD';

const TEMPLATE_URL = '/quyet_dinh_thu_hoi_gpkd_template.docx';

const documentStyles = `
  @page { size: A4; margin: 1.5cm 1.5cm 1.5cm 2.5cm; }
  @page landscape { size: A4 landscape; margin: 1cm 1.5cm 1cm 2cm; }
  .qd-document { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.3; color: #000; }
  .qd-page { box-sizing: border-box; width: 21cm; min-height: 29.7cm; height: auto; margin: 0 auto; padding: 1.5cm 1.5cm 1.5cm 2.5cm; background: #fff; border: 1px solid #cbd5e1; position: relative; }
  .qd-landscape-page { width: 31.7cm; min-height: 21cm; height: auto; padding: 1cm 1.5cm 1cm 2cm; page: landscape; }
  .qd-header, .qd-footer { display: flex; justify-content: space-between; align-items: flex-start; }
  .qd-header-left { width: 40%; text-align: center; }
  .qd-header-right { width: 60%; text-align: center; font-weight: bold; }
  .qd-document-number { margin-top: 10px; }
  .qd-underline, .qd-underline-full { display: inline-block; position: relative; font-weight: bold; }
  .qd-underline::after, .qd-underline-full::after { content: ""; position: absolute; left: 50%; bottom: -5px; height: 1.5px; background: #000; transform: translateX(-50%); }
  .qd-underline::after { width: 50%; }
  .qd-underline-full::after { width: 100%; }
  .qd-title { margin: 20px 0; text-align: center; font-weight: bold; position: relative; }
  .qd-title::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 30%; height: 1.5px; background: #000; transform: translateX(-50%); }
  .qd-decision-title { margin: 20px 0; text-align: center; font-weight: bold; }
  .qd-text-block { margin: 10px 0; text-align: justify; text-indent: 30px; }
  .qd-italic { font-style: italic; }
  .qd-section { margin: 15px 0; text-align: center; font-weight: bold; }
  .qd-article { margin: 10px 0; text-align: justify; text-indent: 30px; }
  .qd-closing { margin: 10px 0; text-align: justify; text-indent: 30px; }
  .qd-footer { margin-top: 20px; }
  .qd-footer-left { width: 60%; }
  .qd-footer-right { width: 40%; text-align: center; }
  .qd-signature-title, .qd-signature-name { font-weight: bold; }
  .qd-signature-name { margin-top: 100px; }
  .qd-recipient-item { margin: 1px 0; }
  .qd-table-container { width: 100%; margin: 20px auto; }
  .qd-table-title { margin-bottom: 20px; text-align: center; font-size: 16pt; font-weight: bold; }
  .qd-table { width: 100%; border-collapse: collapse; border: 1px solid #000; page-break-inside: auto; }
  .qd-table tr { page-break-inside: avoid; break-inside: avoid; }
  .qd-table th, .qd-table td { border: 1px solid #000; padding: 5px; text-align: center; vertical-align: middle; font-size: 12pt; line-height: 1.3; }
  .qd-table th { font-weight: bold; background: #f2f2f2; }
  .qd-table .qd-text-left { text-align: left; }
  .qd-page-break { page-break-after: always; }
  .qd-preview-shell { max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 1rem; }
  .qd-preview-shell .qd-document { width: max-content; min-width: 100%; }
  @media print {
    html, body, #root {
      width: auto !important;
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    .app-print-root,
    .app-print-frame,
    .app-print-content,
    .app-print-main {
      display: block !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: #fff !important;
    }
    aside, header { display: none !important; }
    main { padding: 0 !important; }
    .qd-actions { display: none !important; }
    .qd-preview-shell {
      display: block !important;
      max-width: none !important;
      overflow: visible !important;
      padding: 0 !important;
      background: #fff !important;
    }
    .qd-preview-shell .qd-document {
      display: block !important;
      width: auto !important;
      min-width: 0 !important;
    }
    .qd-page {
      box-sizing: border-box !important;
      width: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      break-after: page;
      page-break-after: always;
    }
    .qd-landscape-page {
      width: auto !important;
      min-height: 0 !important;
      padding: 0 !important;
      page: landscape;
    }
    .qd-page-break {
      display: none !important;
    }
    .qd-document > .qd-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  }
`;

function getFriendlyDecisionError(error) {
  const rawMessage = error?.message || '';
  if (!rawMessage) {
    return 'Không thể tải quyết định. Vui lòng thử lại.';
  }

  if (rawMessage.includes('Thiếu tham số') || rawMessage.includes('Không tìm thấy') || rawMessage.includes('Thiếu cấu hình')) {
    return rawMessage;
  }

  if (rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError')) {
    return 'Không kết nối được Google Sheets. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }

  if (rawMessage.length > 160) {
    return 'Google Sheets trả về lỗi khi tải quyết định. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }

  return rawMessage;
}

const QuyetDinhThuHoiGPKDPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const decisionId = useMemo(() => getDecisionIdFromSearch(location.search), [location.search]);
  const [decisionIdInput, setDecisionIdInput] = useState(decisionId);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDecisionIdInput(decisionId);
  }, [decisionId]);

  useEffect(() => {
    loadData();
    // decisionId thay đổi thì cần nạp lại đúng quyết định
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId]);

  function submitDecisionId(event) {
    event.preventDefault();
    const nextDecisionId = decisionIdInput.trim();

    if (!nextDecisionId) {
      toast.warning('Vui lòng nhập ID quyết định trước khi tải dữ liệu.');
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    searchParams.set('IDQuyetDinh', nextDecisionId);
    navigate({
      pathname: location.pathname,
      search: `?${searchParams.toString()}`
    });
  }

  function openStandaloneHtml() {
    const nextDecisionId = (decisionId || decisionIdInput).trim();

    if (!nextDecisionId) {
      toast.warning('Vui lòng nhập ID quyết định trước khi mở bản HTML.');
      return;
    }

    window.open(`/TN_quyetdinhthuhoi_gbkd_standalone.html?IDQuyetDinh=${encodeURIComponent(nextDecisionId)}`, '_blank');
  }

  async function loadData() {
    if (!decisionId) {
      setPayload(null);
      setErrorMessage('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setErrorMessage('');
      const nextPayload = await fetchQuyetDinhThuHoiData(decisionId);
      setPayload(nextPayload);
    } catch (error) {
      const message = getFriendlyDecisionError(error);
      toast.error(message);
      setErrorMessage(message);
      setPayload(null);
    } finally {
      setLoading(false);
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

      const canCuItems = buildCanCuList(payload.quyetDinh.Ref_CanCuPhapLy, payload.canCuData);
      const signedDate = formatAdministrativeDate(payload.quyetDinh.NgayKy);
      const donViList = payload.chiTietData.map((item, index) => ({
        stt: String(index + 1),
        ten_don_vi: item['Tên đơn vị'] || '',
        dia_chi: item['Địa chỉ sau sáp nhập'] || '',
        so_dkkd: item['Số ĐKKD'] || '',
        so_gp_kdvt: item['Số GP KDVT'] || '',
        ngay_cap: formatAdministrativeDateString(item['Ngày cấp']),
        loai_hinh_van_tai: item['Loại hình vận tải'] || '',
        ly_do_thu_hoi: buildLyDoThuHoi(item).join('\n'),
        can_cu_thu_hoi: item.CanCuThuHoiDuaQD || ''
      }));

      doc.render({
        tinh: payload.tenTinh,
        tinh_upper: String(payload.tenTinh || '').toUpperCase(),
        ngayKy: signedDate.day,
        thangKy: signedDate.month,
        nam: signedDate.year,
        so_don_vi: payload.chiTietData.length,
        can_cu_list: canCuItems.map((value) => ({ noi_dung: value })),
        tham_quyen_ky: payload.nguoiPhuTrachInfo?.ThamQuyen || '',
        chuc_vu_ky: payload.nguoiPhuTrachInfo?.ChucVu || '',
        can_cu_phap_ly: canCuItems.map((value) => `Căn cứ ${value}`).join('\n'),
        nguoi_ky: getNguoiKyName(payload.nguoiPhuTrachInfo),
        don_vi_list: donViList
      });

      const normalizedZip = normalizeQuyetDinhWordLayout(doc.getZip());
      const blob = normalizedZip.generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, `Quyet_dinh_thu_hoi_GPKD_${payload.quyetDinh.SoQuyetDinh || 'new'}.docx`);
    } catch (error) {
      toast.error(`Xuất Word thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  const signedDate = payload ? formatAdministrativeDate(payload.quyetDinh.NgayKy) : { day: '', month: '', year: '' };
  const canCuItems = payload ? buildCanCuList(payload.quyetDinh.Ref_CanCuPhapLy, payload.canCuData) : [];

  return (
    <div className="space-y-6">
      <style>{documentStyles}</style>
      <Card className="qd-actions overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-[280px] flex-1 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <img src={config.LOGO_URL} alt="TAXI 123_HN" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950 sm:text-2xl">
                  Quyết định thu hồi GPKD
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  {decisionId ? `Đã tải quyết định ${decisionId}.` : 'Nhập ID quyết định để tải dữ liệu.'}
                </CardDescription>
              </div>
            </div>
            <form className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end" onSubmit={submitDecisionId}>
              <Input
                aria-label="ID quyết định"
                className="h-10 w-full rounded-xl sm:w-[220px] xl:w-[240px]"
                placeholder="Nhập IDQuyetDinh"
                value={decisionIdInput}
                onChange={(event) => setDecisionIdInput(event.target.value)}
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Tải theo ID
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={openStandaloneHtml}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở bản HTML
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => window.print()} disabled={!payload}>
                <Printer className="mr-2 h-4 w-4" />
                In tài liệu
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={exportToWordTemplate} disabled={exporting || !payload}>
                {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Xuất Word
              </Button>
            </form>
          </div>
        </CardHeader>
      </Card>

      {!decisionId && (
        <Card className="qd-actions">
          <CardHeader>
            <CardTitle>Nhập ID quyết định để bắt đầu</CardTitle>
            <CardDescription>Điền ID vào ô phía trên rồi bấm “Tải theo ID”. Trang sẽ tự thêm `IDQuyetDinh` vào URL để bạn mở lại hoặc chia sẻ tiện hơn.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading && (
        <Card className="qd-actions">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-700">
              <RefreshCw className="h-5 w-5 animate-spin text-sky-700" />
              <div>
                <p className="font-semibold">Đang tải quyết định</p>
                <p className="text-sm text-slate-500">Hệ thống đang lấy dữ liệu từ Google Sheets, vui lòng chờ trong giây lát.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorMessage && !loading && (
        <Card className="qd-actions border-amber-200 bg-amber-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Không tải được quyết định
            </CardTitle>
            <CardDescription className="text-amber-900">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {payload && !loading && (
        <div className="qd-preview-shell">
          <div className="qd-document">
          <div className="qd-page shadow-sm">
            <div className="qd-header">
              <div className="qd-header-left">
                <div style={{ marginBottom: '5px' }}>UBND TỈNH {String(payload.tenTinh || '').toUpperCase()}</div>
                <div className="qd-underline"><strong>SỞ XÂY DỰNG</strong></div>
                <div className="qd-document-number">Số: ______/QĐ-SXD</div>
              </div>
              <div className="qd-header-right">
                <div style={{ marginBottom: '5px' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="qd-underline-full">Độc lập – Tự do – Hạnh phúc</div>
                <div style={{ fontStyle: 'italic', fontWeight: 'normal', marginTop: '10px', textAlign: 'center' }}>
                  {payload.tenTinh}, ngày {signedDate.day} tháng {signedDate.month} năm {signedDate.year}
                </div>
              </div>
            </div>

            <div className="qd-title">
              QUYẾT ĐỊNH
              <br />
              Về việc thu hồi Giấy phép kinh doanh vận tải bằng xe ô tô
            </div>

            <div className="qd-decision-title">GIÁM ĐỐC SỞ XÂY DỰNG TỈNH {String(payload.tenTinh || '').toUpperCase()}</div>

            {canCuItems.map((item) => (
              <div key={item} className="qd-text-block qd-italic">Căn cứ {item};</div>
            ))}

            <div className="qd-text-block qd-italic">
              Căn cứ Văn bản thông báo ngừng hoạt động kinh doanh vận tải bằng xe ô tô của đơn vị vận tải (chi tiết
              tại Phụ lục đính kèm);
            </div>

            <div className="qd-text-block qd-italic">Theo đề nghị của Trưởng phòng Vận tải và An toàn giao thông.</div>

            <div className="qd-section">QUYẾT ĐỊNH:</div>

            <div className="qd-article">
              <strong>Điều 1.</strong> Thu hồi Giấy phép kinh doanh vận tải bằng xe ô tô không thời hạn của {payload.chiTietData.length} đơn vị{' '}
              <span className="qd-italic">(có danh sách kèm theo)</span>.
            </div>

            <div className="qd-article">
              <strong>Điều 2.</strong> Trong thời hạn 10 ngày kể từ ngày ký Quyết định này, các đơn vị có tên tại Điều 1 phải nộp
              lại Giấy phép kinh doanh về Sở Xây dựng tỉnh {payload.tenTinh} đồng thời dừng hoạt động kinh doanh vận tải
              theo quyết định thu hồi.
            </div>

            <div className="qd-article"><strong>Điều 3.</strong> Quyết định này có hiệu lực kể từ ngày ký.</div>

            <div className="qd-closing">
              Các Ông (Bà): Chánh Văn phòng Sở, Trưởng phòng Vận tải và An toàn giao thông, Chánh Thanh tra Sở, Thủ
              trưởng các đơn vị bị thu hồi Giấy phép và các đơn vị liên quan chịu trách nhiệm thi hành Quyết định này./.
            </div>

            <div className="qd-footer">
              <div className="qd-footer-left">
                <div><strong>Nơi nhận:</strong></div>
                <div className="qd-recipient-item">- Như Điều 3;</div>
                <div className="qd-recipient-item">- UBND tỉnh (b/c);</div>
                <div className="qd-recipient-item">- Công an tỉnh (p/h);</div>
                <div className="qd-recipient-item">- Cục Thuế tỉnh (p/h);</div>
                <div className="qd-recipient-item">- UBND các huyện, thị xã, TP; UBND các xã,</div>
                <div className="qd-recipient-item">&nbsp;&nbsp;phường, thị trấn nơi đơn vị đặt trụ sở (p/h);</div>
                <div className="qd-recipient-item">- Giám đốc Sở (b/c);</div>
                <div className="qd-recipient-item">- Văn phòng Sở (đăng Website);</div>
                <div className="qd-recipient-item">- Thanh tra Sở;</div>
                <div className="qd-recipient-item">- Lưu: VT, VTATGT.</div>
              </div>
              <div className="qd-footer-right">
                <div className="qd-signature-title">{payload.nguoiPhuTrachInfo?.ThamQuyen || ''}</div>
                <div className="qd-signature-title">{payload.nguoiPhuTrachInfo?.ChucVu || ''}</div>
                <div style={{ marginTop: '195px' }} />
                <div className="qd-signature-name">{getNguoiKyName(payload.nguoiPhuTrachInfo)}</div>
              </div>
            </div>
          </div>

          <div className="qd-page-break" />

          <div className="qd-page qd-landscape-page shadow-sm">
            <div className="qd-table-container">
              <div className="qd-table-title">
                DANH SÁCH CÁC ĐƠN VỊ BỊ THU HỒI GIẤY PHÉP KINH DOANH VẬN TẢI BẰNG XE Ô TÔ
              </div>
              <table className="qd-table">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>STT</th>
                    <th style={{ width: '15%' }}>Tên đơn vị</th>
                    <th style={{ width: '15%' }}>Địa chỉ</th>
                    <th style={{ width: '8%' }}>Số ĐKKD</th>
                    <th style={{ width: '12%' }}>Số GP KĐVT</th>
                    <th style={{ width: '8%' }}>Ngày cấp</th>
                    <th style={{ width: '10%' }}>Loại hình vận tải</th>
                    <th style={{ width: '14%' }}>Lý do thu hồi</th>
                    <th style={{ width: '13%' }}>Căn cứ thu hồi</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.chiTietData.map((item, index) => (
                    <tr key={`${item.ID || index}`}>
                      <td>{index + 1}</td>
                      <td className="qd-text-left">{item['Tên đơn vị'] || ''}</td>
                      <td className="qd-text-left">{item['Địa chỉ sau sáp nhập'] || ''}</td>
                      <td>{item['Số ĐKKD'] || ''}</td>
                      <td>{item['Số GP KDVT'] || ''}</td>
                      <td>{formatAdministrativeDateString(item['Ngày cấp'])}</td>
                      <td>{item['Loại hình vận tải'] || ''}</td>
                      <td className="qd-text-left">{buildLyDoThuHoi(item).join(' ')}</td>
                      <td className="qd-text-left">{item.CanCuThuHoiDuaQD || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default QuyetDinhThuHoiGPKDPage;
