import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/hooks';
import Layout from './components/Layout';
import { ConfirmProvider, Toaster } from './components/ui';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Departments from './pages/Departments';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Recruitment from './pages/Recruitment';
import Training from './pages/Training';
import Payroll from './pages/Payroll';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Holidays from './pages/Holidays';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeDetail />} />
              <Route path="departments" element={<Departments />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="leaves" element={<Leaves />} />
              <Route path="recruitment" element={<Recruitment />} />
              <Route path="training" element={<Training />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="orders" element={<Orders />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="holidays" element={<Holidays />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
