import React from 'react';
import { ArrowRight, BookMarked, FileText, IdCard, Car, HandCoins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import config from '../config/config';

const actions = [
  {
    title: 'Thống kê phù hiệu',
    description: 'Xem, lọc và xuất thống kê phù hiệu theo đơn vị vận tải.',
    path: config.ROUTES.THONG_KE_PHU_HIEU_REACT,
    icon: IdCard,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Thu hồi GPKD',
    description: 'Xem trước, in và xuất quyết định thu hồi giấy phép.',
    path: `${config.ROUTES.QUYET_DINH_THU_HOI_GPKD_REACT}?IDQuyetDinh=`,
    icon: FileText,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Bàn giao xe',
    description: 'Quản lý, lập và xuất biên bản bàn giao xe chi tiết cho lái xe.',
    path: config.ROUTES.BAN_GIAO_XE_REACT,
    icon: Car,
    tone: 'bg-emerald-50 text-emerald-700'
  },
  {
    title: 'Ký quỹ lái xe',
    description: 'Xem trước, in và xuất hợp đồng ký quỹ của lái xe từ AppSheet.',
    path: config.ROUTES.KY_QUY_LAI_XE_REACT,
    icon: HandCoins,
    tone: 'bg-sky-50 text-sky-700'
  },
  {
    title: 'Bàn giao sổ BHXH',
    description: 'Xem trước, in và xuất biên bản bàn giao sổ bảo hiểm xã hội.',
    path: config.ROUTES.BAN_GIAO_SO_BHXH_REACT,
    icon: BookMarked,
    tone: 'bg-violet-50 text-violet-700'
  }
];

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Chức năng chính</h1>
        <p className="mt-1 text-sm text-slate-500">Chọn nghiệp vụ cần thực hiện.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="flex flex-col justify-between transition hover:border-red-200 hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <CardTitle className="text-lg font-semibold text-slate-900">{item.title}</CardTitle>
                  <CardDescription className="text-sm text-slate-500 leading-relaxed">{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Button asChild className="w-full justify-between">
                  <Link to={item.path}>
                    Mở chức năng
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardPage;
