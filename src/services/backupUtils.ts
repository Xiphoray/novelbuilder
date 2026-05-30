/**
 * 备份工具函数
 */

import type { BackupPreview, BackupData } from './backupTypes';

/**
 * 获取备份预览信息（不实际导入）
 */
export function getBackupPreview(data: BackupData): BackupPreview {
  const totalWordCount = data.books.reduce((sum, b) => sum + (b.totalWordCount || 0), 0);
  const date = new Date(data.exportedAt);
  const exportedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return {
    bookCount: data.books.length,
    chapterCount: data.chapters.length,
    totalWordCount,
    exportedDate,
    bookTitles: data.books.map((b) => b.title),
  };
}

/**
 * 格式化字数
 */
export function formatWordCount(count: number): string {
  if (count < 10000) return `${count} 字`;
  return `${(count / 10000).toFixed(1)} 万字`;
}
