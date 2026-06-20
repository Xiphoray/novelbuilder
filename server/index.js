import express from 'express';
import cors from 'cors';
import { log, LOG_DIR } from './utils/logger.js';
import { getConfigStore, CONFIG_FILE } from './utils/configStore.js';
import configRoutes from './routes/config.js';
import generateRoutes from './routes/generate.js';

const app = express();
const PORT = 5299;

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  log('INFO', `→ ${req.method} ${req.url}`, {
    query: req.query,
    bodyKeys: Object.keys(req.body || {}),
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('INFO', `← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// ============ 路由注册 ============
app.use(configRoutes);
app.use(generateRoutes);

// ============ 健康检查端点 ============
app.get('/health', (req, res) => {
  const configStore = getConfigStore();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    configCount: configStore.providers.length,
  });
});

// ============ 启动服务 ============
app.listen(PORT, () => {
  log('INFO', `🚀 NovelBuilder API Server started on http://localhost:${PORT}`);
  log('INFO', `📝 Logs directory: ${LOG_DIR}`);
  log('INFO', `📦 Config file: ${CONFIG_FILE}`);
  
  console.log(`\n========================================`);
  console.log(`  NovelBuilder API Server`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Logs: ${LOG_DIR}`);
  console.log(`========================================\n`);
});
