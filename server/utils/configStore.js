import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.js';
import { encrypt, decrypt, masterKeyFingerprint } from './cryptoStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG_FILE = path.join(__dirname, '../config.json');

/**
 * 把内存中的 config 序列化为"可持久化"形态：
 *   - 移除每个 provider 上的明文 apiKey
 *   - 保留 encryptedKeys 字典
 */
function toPersistable(config) {
  const sanitized = {
    providers: config.providers.map((p) => {
      const { apiKey, ...rest } = p;
      return rest;
    }),
    activeProviderId: config.activeProviderId,
  };
  if (config.encryptedKeys) {
    sanitized.encryptedKeys = config.encryptedKeys;
  }
  return sanitized;
}

/**
 * 从磁盘加载，自动迁移历史明文 apiKey 到加密层。
 */
export function loadConfig() {
  let raw;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    log('ERROR', 'Failed to load config', { error: e.message });
  }
  const config = raw || { providers: [], activeProviderId: null };
  if (!config.encryptedKeys || typeof config.encryptedKeys !== 'object') {
    config.encryptedKeys = {};
  }

  // 迁移：发现明文 apiKey -> 加密到 encryptedKeys，并从内存中清掉明文
  let migrated = 0;
  for (const p of config.providers) {
    if (p.apiKey) {
      try {
        config.encryptedKeys[p.id] = encrypt(p.apiKey);
        delete p.apiKey;
        migrated += 1;
      } catch (e) {
        log('ERROR', `Failed to migrate apiKey for ${p.id}`, { error: e.message });
      }
    }
  }
  if (migrated > 0) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(toPersistable(config), null, 2));
      log('INFO', `ConfigStore: migrated ${migrated} plaintext apiKey(s) to encrypted storage`);
    } catch (e) {
      log('ERROR', 'ConfigStore: failed to persist after migration', { error: e.message });
    }
  }

  return config;
}

/**
 * 写入磁盘。自动剥离 provider 上的明文 apiKey。
 */
export function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toPersistable(config), null, 2));
}

// 创建配置存储实例
let configStore = loadConfig();

export function getConfigStore() {
  return configStore;
}

export function setConfigStore(newConfig) {
  configStore = newConfig;
}

/* ========== 敏感字段访问 API ========== */

/**
 * 取某个 provider 的 apiKey（解密后的明文）。若缺失返回 ''。
 */
export function getApiKey(providerId) {
  if (!providerId) return '';
  const store = getConfigStore();
  const provider = store.providers.find((p) => p.id === providerId);
  if (provider && provider.apiKey) return provider.apiKey;
  const payload = store.encryptedKeys?.[providerId];
  if (payload) return decrypt(payload);
  return '';
}

/**
 * 写入 / 更新某个 provider 的 apiKey：内存+加密字典。
 * 调用方负责把 provider 对象保存到 configStore。
 */
export function setApiKey(providerId, plain) {
  if (!providerId) return;
  const store = getConfigStore();
  if (!store.encryptedKeys || typeof store.encryptedKeys !== 'object') {
    store.encryptedKeys = {};
  }
  if (plain == null || plain === '') {
    delete store.encryptedKeys[providerId];
  } else {
    store.encryptedKeys[providerId] = encrypt(plain);
  }
}

/**
 * 删除某个 provider 的密文。
 */
export function removeApiKey(providerId) {
  const store = getConfigStore();
  if (store.encryptedKeys && store.encryptedKeys[providerId]) {
    delete store.encryptedKeys[providerId];
  }
}

/**
 * 用一个统一的"补全 apiKey"的工具：调用方传入 config（含 id），返回带明文 apiKey 的副本。
 * 不修改原始 config。
 */
export function withApiKey(config) {
  if (!config) return config;
  if (config.apiKey) return config;
  const key = getApiKey(config.id);
  return { ...config, apiKey: key };
}

log('INFO', `ConfigStore ready (master key fp=${masterKeyFingerprint()})`);
