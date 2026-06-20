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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'react-vendor'
          }

          if (
            id.includes('@ant-design/icons') ||
            id.includes('@ant-design/icons-svg')
          ) {
            return 'antd-icons-vendor'
          }

          if (
            id.includes('rc-')
          ) {
            return 'antd-rc-vendor'
          }

          if (
            id.includes('@ant-design')
          ) {
            return 'antd-core-vendor'
          }

          if (
            id.includes('antd')
          ) {
            return 'antd-vendor'
          }

          if (
            id.includes('dexie') ||
            id.includes('fake-indexeddb')
          ) {
            return 'db-vendor'
          }

          if (
            id.includes('uuid') ||
            id.includes('dayjs') ||
            id.includes('jschardet')
          ) {
            return 'utils-vendor'
          }
        },
      },
    },
  },
  server: {
    port: 5298,
    strictPort: true,
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
