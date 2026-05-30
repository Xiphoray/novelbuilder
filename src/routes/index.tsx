import { createHashRouter } from 'react-router-dom';
import RootLayout from '@/layouts/RootLayout';
import ReaderPage from '@/pages/ReaderPage';
import SettingsPage from '@/pages/SettingsPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <ReaderPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
]);
