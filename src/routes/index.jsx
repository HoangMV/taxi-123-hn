import React from 'react';
import { Navigate } from 'react-router-dom';
import config from '../config/config';
import BanGiaoXePage from '../pages/BanGiaoXePage';
import DashboardPage from '../pages/DashboardPage';
import QuyetDinhThuHoiGPKDPage from '../pages/QuyetDinhThuHoiGPKDPage';
import ThongKePhuHieuDonViPage from '../pages/ThongKePhuHieuDonViPage';

export const appRoutes = [
  { path: config.ROUTES.HOME, element: <Navigate to={config.ROUTES.DASHBOARD} replace /> },
  { path: config.ROUTES.DASHBOARD, element: <DashboardPage /> },
  { path: config.ROUTES.THONG_KE_PHU_HIEU_REACT, element: <ThongKePhuHieuDonViPage /> },
  { path: config.ROUTES.QUYET_DINH_THU_HOI_GPKD_REACT, element: <QuyetDinhThuHoiGPKDPage /> },
  { path: config.ROUTES.BAN_GIAO_XE_REACT, element: <BanGiaoXePage /> },
  { path: '*', element: <Navigate to={config.ROUTES.DASHBOARD} replace /> }
];
