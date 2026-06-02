import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 修复 antd v5 在 React 19 下的兼容告警：https://u.ant.design/v5-for-19
import '@ant-design/v5-patch-for-react-19'
import '@/styles/global.css'
import App from './App.tsx'

// 仅在生产环境注册 Service Worker，避免开发期 HMR / API 代理被 SW 拦截
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // 周期性检查更新（每 60 分钟），便于发布后用户能拿到新缓存
        const CHECK_INTERVAL = 60 * 60 * 1000
        const tick = () => reg.update().catch(() => undefined)
        setInterval(tick, CHECK_INTERVAL)
        // 收到新 SW 后，提示用户刷新（这里仅打印，UI 提示可在 RootLayout 接入）
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[PWA] 新版本已就绪，刷新页面以启用。')
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册失败：', err)
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
