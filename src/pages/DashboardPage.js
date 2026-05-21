import React from 'react';
import { ArrowRight, FileText, IdCard } from 'lucide-react';
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
  }
];

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Chức năng chính</h1>
        <p className="mt-1 text-sm text-slate-500">Chọn nghiệp vụ cần thực hiện.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="transition hover:border-red-200 hover:shadow-md">
              <CardHeader>
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
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
