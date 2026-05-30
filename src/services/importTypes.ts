/**
 * 导入服务相关类型定义
 */

import type { Book, Chapter } from '@/types';

/** 导入结果 */
export interface ImportResult {
  book: Book;
  chapters: Chapter[];
}
