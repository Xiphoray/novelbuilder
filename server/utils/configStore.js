import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG_FILE = path.join(__dirname, '../config.json');

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    log('ERROR', 'Failed to load config', { error: e.message });
  }
  return { providers: [], activeProviderId: null };
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 创建配置存储实例
let configStore = loadConfig();

export function getConfigStore() {
  return configStore;
}

export function setConfigStore(newConfig) {
  configStore = newConfig;
}
