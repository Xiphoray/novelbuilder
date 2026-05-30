/**
 * 备份服务相关类型定义
 */

import type { Book, Chapter, GenerationHistory, ReadingSettings } from '@/types';

/** 备份文件版本号 */
export const BACKUP_VERSION = '1.0';

/** 备份数据结构 */
export interface BackupData {
  version: string;
  exportedAt: number;
  appVersion: string;
  books: Book[];
  chapters: Chapter[];
  generationHistory: GenerationHistory[];
  settings: {
    readingSettings: ReadingSettings;
  };
}

/** 恢复冲突处理策略 */
export type ConflictStrategy = 'overwrite' | 'skip' | 'rename';

/** 恢复结果 */
export interface RestoreResult {
  booksImported: number;
  booksSkipped: number;
  chaptersImported: number;
  historyImported: number;
  conflicts: {
    bookTitle: string;
    action: ConflictStrategy | 'conflict';
  }[];
}

/** 备份预览信息 */
export interface BackupPreview {
  bookCount: number;
  chapterCount: number;
  totalWordCount: number;
  exportedDate: string;
  bookTitles: string[];
}
