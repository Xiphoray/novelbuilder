import { Suspense, lazy } from 'react';
import { createHashRouter } from 'react-router-dom';
import { Spin } from 'antd';
import RootLayout from '@/layouts/RootLayout';

const ReaderPage = lazy(() => import('@/pages/ReaderPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));

const routeFallback = (
  <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={routeFallback}>
            <ReaderPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={routeFallback}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={routeFallback}>
            <HistoryPage />
          </Suspense>
        ),
      },
    ],
  },
]);
