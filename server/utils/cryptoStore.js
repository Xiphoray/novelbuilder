/**
 * 敏感字段加密存储 (AES-256-GCM)
 *
 * - 主密钥加载顺序：process.env.AI_KEY_MASTER > server/.env(AI_KEY_MASTER=) > server/.master.key > 自动生成
 * - 自动生成时，密钥以 base64 写入 server/.master.key（已 .gitignore）
 * - 加密载荷格式：{ v: 1, alg: 'aes-256-gcm', iv: '<b64>', tag: '<b64>', ct: '<b64>' }
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { log } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..');

const MASTER_KEY_PATH = path.join(SERVER_DIR, '.master.key');
const ENV_FILE_PATH = path.join(SERVER_DIR, '.env');

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits recommended for GCM

let _masterKey = null;

function ensureMasterKey() {
  if (_masterKey) return _masterKey;

  // 1) 进程环境变量优先
  if (process.env.AI_KEY_MASTER && process.env.AI_KEY_MASTER.length >= 32) {
    _masterKey = Buffer.from(process.env.AI_KEY_MASTER, 'base64');
    if (_masterKey.length === KEY_LEN) {
      log('INFO', 'CryptoStore: master key loaded from process.env.AI_KEY_MASTER');
      return _masterKey;
    }
  }

  // 2) .env 文件（轻量配置，不入 git）
  if (fs.existsSync(ENV_FILE_PATH)) {
    try {
      const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      const match = content.match(/^\s*AI_KEY_MASTER\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
      if (match && match[1].length >= 32) {
        _masterKey = Buffer.from(match[1], 'base64');
        if (_masterKey.length === KEY_LEN) {
          log('INFO', 'CryptoStore: master key loaded from .env');
          return _masterKey;
        }
      }
    } catch (e) {
      log('WARN', 'CryptoStore: failed to read .env', { error: e.message });
    }
  }

  // 3) .master.key 文件
  if (fs.existsSync(MASTER_KEY_PATH)) {
    try {
      const raw = fs.readFileSync(MASTER_KEY_PATH, 'utf-8').trim();
      _masterKey = Buffer.from(raw, 'base64');
      if (_masterKey.length === KEY_LEN) {
        log('INFO', 'CryptoStore: master key loaded from .master.key');
        return _masterKey;
      }
    } catch (e) {
      log('WARN', 'CryptoStore: failed to read .master.key', { error: e.message });
    }
  }

  // 4) 自动生成并持久化
  const newKey = crypto.randomBytes(KEY_LEN);
  try {
    fs.writeFileSync(MASTER_KEY_PATH, newKey.toString('base64'), { mode: 0o600 });
    log('INFO', `CryptoStore: new master key generated at ${MASTER_KEY_PATH}`);
  } catch (e) {
    log('ERROR', 'CryptoStore: failed to persist master key', { error: e.message });
  }
  _masterKey = newKey;
  return _masterKey;
}

function parseEnvValue(raw) {
  if (!raw) return null;
  const m = raw.match(/^\s*AI_KEY_MASTER\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m);
  return m ? m[1] : null;
}

/**
 * 加密一段明文。
 * @param {string} plain
 * @returns {{v:number, alg:string, iv:string, tag:string, ct:string}}
 */
export function encrypt(plain) {
  if (plain == null) return null;
  const key = ensureMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: ALGO,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  };
}

/**
 * 解密一段密文载荷。
 * @param {{v:number, alg:string, iv:string, tag:string, ct:string}} payload
 * @returns {string}
 */
export function decrypt(payload) {
  if (!payload || !payload.iv || !payload.tag || !payload.ct) return '';
  try {
    const key = ensureMasterKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ct = Buffer.from(payload.ct, 'base64');
    const decipher = crypto.createDecipheriv(payload.alg || ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf-8');
  } catch (e) {
    log('ERROR', 'CryptoStore: decrypt failed', { error: e.message });
    return '';
  }
}

/**
 * 仅供调试 / 启动日志：返回主密钥指纹（不返回密钥本身）。
 */
export function masterKeyFingerprint() {
  const key = ensureMasterKey();
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}
