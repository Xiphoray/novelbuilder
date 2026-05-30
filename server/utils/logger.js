import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFileName() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `api-${dateStr}.log`);
}

export function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // 写入文件
  fs.appendFileSync(getLogFileName(), logLine);
  
  // 同时输出到控制台
  const consoleMsg = `[${timestamp}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(consoleMsg, data ? JSON.stringify(data).slice(0, 500) : '');
  } else {
    console.log(consoleMsg, data ? JSON.stringify(data).slice(0, 200) : '');
  }
}
