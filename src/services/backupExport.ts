/**
 * 备份导出功能
 */

import { db } from './db';
import { DEFAULT_READING_SETTINGS } from '@/types';
import { BACKUP_VERSION, type BackupData } from './backupTypes';

/**
 * 导出备份数据为 JSON
 */
export async function exportBackup(): Promise<BackupData> {
  const [books, chapters, generationHistory] = await Promise.all([
    db.books.toArray(),
    db.chapters.toArray(),
    db.generationHistory.toArray(),
  ]);

  // 从 localStorage 读取阅读设置
  let readingSettings = DEFAULT_READING_SETTINGS;
  try {
    const stored = localStorage.getItem('novelbuilder_reading_settings');
    if (stored) {
      readingSettings = { ...DEFAULT_READING_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // 使用默认值
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    books,
    chapters,
    generationHistory,
    settings: {
      readingSettings,
    },
  };
}

/**
 * 下载备份文件
 */
export async function downloadBackup(): Promise<void> {
  const data = await exportBackup();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `novelbuilder-backup-${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
