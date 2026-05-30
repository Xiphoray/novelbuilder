/**
 * 备份导入功能
 */

import { BACKUP_VERSION, type BackupData } from './backupTypes';

/**
 * 验证备份文件格式
 */
export function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  // 必须包含 version 字段
  if (typeof obj.version !== 'string') return false;

  // 版本号兼容检查
  const versionMajor = obj.version.split('.')[0] ?? '';
  const backupMajor = BACKUP_VERSION.split('.')[0] ?? '1';
  const major = parseInt(versionMajor, 10);
  if (isNaN(major) || major > parseInt(backupMajor, 10)) return false;

  // 必须包含 books 和 chapters 数组
  if (!Array.isArray(obj.books)) return false;
  if (!Array.isArray(obj.chapters)) return false;

  // 基本字段检查
  for (const book of obj.books as Record<string, unknown>[]) {
    if (typeof book.id !== 'string' || typeof book.title !== 'string' || typeof book.type !== 'string') return false;
  }

  return true;
}

/**
 * 从 JSON 文件读取备份数据
 */
export async function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!validateBackup(data)) {
          reject(new Error('备份文件格式无效或版本不兼容'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('备份文件解析失败，请确认文件格式正确'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}
