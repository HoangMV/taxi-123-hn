import { createContext, useContext } from 'react';

export const DashboardContext = createContext(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard phải được dùng bên trong DashboardLayout.');
  return ctx;
}
