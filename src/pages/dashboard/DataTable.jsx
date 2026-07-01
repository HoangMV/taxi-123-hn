import React from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { formatNumber } from './components';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const warningLabels = { do: 'Đỏ', vang: 'Vàng', xanh: 'Xanh', xam: 'Xám' };
const warningClasses = {
  do: 'border-red-200 bg-red-50 text-red-700',
  vang: 'border-amber-200 bg-amber-50 text-amber-700',
  xanh: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  xam: 'border-slate-200 bg-slate-100 text-slate-600'
};

function WarningBadge({ item }) {
  const level = item.level || 'xam';
  return (
    <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${warningClasses[level] || warningClasses.xam}`}>
      {item.label || warningLabels[level] || 'Xám'}: {item.name}{item.date ? ` (${item.date})` : ''}
    </span>
  );
}

function WarningBadgeList({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${warningClasses.xanh}`}>Còn hiệu lực</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {list.map((item, index) => <WarningBadge key={`${item.name}-${index}`} item={item} />)}
    </div>
  );
}

const COLUMNS = {
  'nhan-su': [
    ['stt', 'STT'], ['hoTen', 'Họ tên'], ['cccd', 'CCCD'], ['doiXe', 'Đội xe'],
    ['chucDanh', 'Chức danh'], ['trangThaiLamViec', 'Trạng thái'], ['bienSoXe', 'Biển số'],
    ['ngayKetThuc', 'Hạn HĐLĐ'], ['hanGplx', 'Hạn GPLX'], ['hanSucKhoe', 'Hạn sức khỏe'], ['canhBao', 'Cảnh báo']
  ],
  xe: [
    ['stt', 'STT'], ['bienSo', 'Biển số'], ['maDam', 'Mã đàm'], ['loaiXe', 'Loại xe'],
    ['doiXe', 'Đội xe'], ['trangThaiXe', 'Trạng thái'], ['laiXeDangLai', 'Lái xe'],
    ['hanPhuHieu', 'Hạn phù hiệu'], ['hanDangKiem', 'Hạn đăng kiểm'],
    ['hanBaoHiemTnds', 'Hạn BH TNDS'], ['hanBaoHiemThanVo', 'Hạn BH thân vỏ'], ['hanTaximet', 'Hạn taximet'],
    ['canhBao', 'Cảnh báo']
  ]
};

function DataTable({ type, rows, page, pageSize, onPageChange, onPageSizeChange }) {
  const columns = COLUMNS[type] || COLUMNS.xe;
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = totalRows ? (safePage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const pageRows = rows.slice(startIndex, endIndex);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{columns.map(([, label]) => <th key={label} className="whitespace-nowrap px-3 py-3 font-bold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row) => (
              <tr key={`${type}-${row.stt}-${row.idNhanSu || row.idXe}`} className="align-top hover:bg-slate-50">
                {columns.map(([key]) => (
                  <td key={key} className="max-w-[240px] px-3 py-3 text-slate-700">
                    {key === 'canhBao' ? (
                      <div className="flex min-w-40 flex-col items-start gap-1"><WarningBadgeList items={row.warningItems} /></div>
                    ) : type === 'xe' && key === 'bienSo' && row.idXe ? (
                      <a className="inline-flex max-w-full items-center gap-1 font-medium text-blue-700 underline-offset-2 hover:underline" href={`/vehicle_profile_standalone.html?ID_Xe=${encodeURIComponent(row.idXe)}`} target="_blank" rel="noreferrer" title={`Mở hồ sơ xe ${row.bienSo || row.idXe}`}>
                        <span className="truncate">{row[key] || row.idXe}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : type === 'nhan-su' && key === 'hoTen' && row.idNhanSu ? (
                      <a className="inline-flex max-w-full items-center gap-1 font-medium text-blue-700 underline-offset-2 hover:underline" href={`/nhan_su_profile_standalone.html?ID_NhanSu=${encodeURIComponent(row.idNhanSu)}`} target="_blank" rel="noreferrer" title={`Mở hồ sơ nhân sự ${row.hoTen || row.idNhanSu}`}>
                        <span className="line-clamp-2">{row[key] || row.idNhanSu}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="line-clamp-2">{row[key] || ''}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">Không có dữ liệu phù hợp bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold">
          {totalRows > 0 ? `Hiển thị ${formatNumber(startIndex + 1)}-${formatNumber(endIndex)} / ${formatNumber(totalRows)} dòng` : 'Không có dòng để hiển thị'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Dòng/trang
            <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-slate-700" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <Button type="button" variant="secondary" className="h-9 px-2" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-24 text-center font-bold text-slate-700">Trang {formatNumber(safePage)} / {formatNumber(totalPages)}</span>
          <Button type="button" variant="secondary" className="h-9 px-2" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
