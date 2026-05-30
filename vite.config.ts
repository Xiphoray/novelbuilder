import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5298,
    host: '0.0.0.0',
    open: true,
    proxy: {
      // 前端 /api 转发到后端（5299端口）
      '/api': {
        target: 'http://localhost:5299',
        changeOrigin: true,
      },
      // 健康检查端点
      '/health': {
        target: 'http://localhost:5299',
        changeOrigin: true,
      },
    },
  },
})
