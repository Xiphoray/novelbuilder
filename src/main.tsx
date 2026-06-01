import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp } from 'antd'
// 修复 antd v5 在 React 19 下的兼容告警：https://u.ant.design/v5-for-19
import '@ant-design/v5-patch-for-react-19'
import '@/styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdApp>
      <App />
    </AntdApp>
  </StrictMode>,
)
