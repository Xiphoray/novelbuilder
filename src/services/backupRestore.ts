/**
 * 备份恢复功能
 */

import { db } from './db';
import type { Book, Chapter, GenerationHistory } from '@/types';
import { DEFAULT_READING_SETTINGS } from '@/types';
import type { BackupData, ConflictStrategy, RestoreResult } from './backupTypes';

/**
 * 从备份数据恢复
 */
export async function restoreBackup(
  data: BackupData,
  conflictStrategy: ConflictStrategy = 'skip',
): Promise<RestoreResult> {
  const result: RestoreResult = {
    booksImported: 0,
    booksSkipped: 0,
    chaptersImported: 0,
    historyImported: 0,
    conflicts: [],
  };

  // 获取现有书籍
  const existingBooks = await db.books.toArray();
  const existingBookMap = new Map(existingBooks.map((b) => [b.id, b]));
  const existingTitleMap = new Map(existingBooks.map((b) => [b.title, b]));

  // 处理书籍导入
  const booksToImport: Book[] = [];
  const bookIdMapping = new Map<string, string>(); // oldId -> newId

  for (const book of data.books) {
    const existingById = existingBookMap.get(book.id);
    const existingByTitle = existingTitleMap.get(book.title);
    const existing = existingById || existingByTitle;

    if (existing) {
      result.conflicts.push({ bookTitle: book.title, action: 'conflict' });

      switch (conflictStrategy) {
        case 'overwrite': {
          // 覆盖：删除旧数据，导入新数据
          await db.chapters.where('bookId').equals(existing.id).delete();
          await db.generationHistory.where('bookId').equals(existing.id).delete();
          const importBook = { ...book, id: existing.id };
          booksToImport.push(importBook);
          bookIdMapping.set(book.id, existing.id);
          result.booksImported++;
          result.conflicts[result.conflicts.length - 1]!.action = 'overwrite';
          break;
        }
        case 'skip': {
          // 跳过
          result.booksSkipped++;
          result.conflicts[result.conflicts.length - 1]!.action = 'skip';
          break;
        }
        case 'rename': {
          // 重命名：添加后缀
          const { v4: uuidv4 } = await import('uuid');
          const newId = uuidv4();
          let newTitle = book.title;
          let suffix = 1;
          while (existingTitleMap.has(newTitle)) {
            newTitle = `${book.title} (${suffix})`;
            suffix++;
          }
          const importBook = { ...book, id: newId, title: newTitle };
          booksToImport.push(importBook);
          bookIdMapping.set(book.id, newId);
          existingTitleMap.set(newTitle, importBook);
          result.booksImported++;
          result.conflicts[result.conflicts.length - 1]!.action = 'rename';
          break;
        }
      }
    } else {
      // 无冲突，直接导入
      booksToImport.push(book);
      bookIdMapping.set(book.id, book.id);
      result.booksImported++;
    }
  }

  // 批量写入书籍
  if (booksToImport.length > 0) {
    await db.books.bulkPut(booksToImport);
  }

  // 导入章节
  const chaptersToImport: Chapter[] = [];
  for (const chapter of data.chapters) {
    const mappedBookId = bookIdMapping.get(chapter.bookId);
    if (!mappedBookId) continue; // 对应书籍被跳过

    // 检查是否已存在
    const existingChapter = await db.chapters
      .where('[bookId+index]')
      .equals([mappedBookId, chapter.index])
      .first();

    if (existingChapter && conflictStrategy === 'skip') continue;

    chaptersToImport.push({
      ...chapter,
      bookId: mappedBookId,
    });
  }

  if (chaptersToImport.length > 0) {
    await db.chapters.bulkPut(chaptersToImport);
    result.chaptersImported = chaptersToImport.length;
  }

  // 导入生成历史
  const historyToImport: GenerationHistory[] = [];
  for (const history of (data.generationHistory ?? [])) {
    const mappedBookId = bookIdMapping.get(history.bookId);
    if (!mappedBookId) continue;

    historyToImport.push({
      ...history,
      bookId: mappedBookId,
    });
  }

  if (historyToImport.length > 0) {
    await db.generationHistory.bulkPut(historyToImport);
    result.historyImported = historyToImport.length;
  }

  // 恢复阅读设置
  if (data.settings?.readingSettings) {
    try {
      const stored = localStorage.getItem('novelbuilder_reading_settings');
      const current = stored ? JSON.parse(stored) : {};
      current.readingSettings = {
        ...DEFAULT_READING_SETTINGS,
        ...data.settings.readingSettings,
      };
      localStorage.setItem('novelbuilder_reading_settings', JSON.stringify(current));
    } catch {
      // 忽略设置恢复失败
    }
  }

  return result;
}
