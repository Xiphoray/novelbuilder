/**
 * F-001: 文件导入服务
 * 支持从 TXT 文件导入小说，自动检测编码并分割章节
 */

import { v4 as uuidv4 } from 'uuid';
import { message } from 'antd';
import { db } from './db';
import type { Book, Chapter } from '@/types';
import type { ImportResult } from './importTypes';
import { decodeFileBuffer, tryDecode } from './importEncoding';
import { splitIntoChapters } from './importSplitter';

export type { ImportResult } from './importTypes';
export { tryDecode } from './importEncoding';

/**
 * 从文件导入书籍
 */
export async function importBookFromFile(file: File, forceEncoding?: string): Promise<ImportResult> {
  // 验证文件类型
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('仅支持 .txt 格式的文件');
  }

  // 验证文件大小（限制 7MB）
  const MAX_SIZE = 7 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`文件过大（${Math.round(file.size / 1024 / 1024)}MB），最大支持 7MB`);
  }

  if (file.size === 0) {
    throw new Error('文件为空');
  }

  // 读取文件
  const buffer = await file.arrayBuffer();

  // 检测编码并解码（允许传入强制编码）
  const { text, encoding } = forceEncoding
    ? { text: tryDecode(new Uint8Array(buffer), forceEncoding), encoding: forceEncoding }
    : decodeFileBuffer(buffer);

  if (!text || text.trim().length === 0) {
    // 编码检测失败，抛出特定错误，交由调用方弹出选择框
    const err = new Error('无法自动识别编码，请手动选择') as Error & { code?: string };
    err.code = 'ENCODING_DETECTION_FAILED';
    throw err;
  }

  console.log(`[ImportService] 文件 "${file.name}" 检测编码: ${encoding}, 内容长度: ${text.length}`);

  // 分割章节
  const chapterParts = splitIntoChapters(text);
  console.log(`[ImportService] 分割完成: ${chapterParts.length} 章`);
  if (chapterParts.length === 0) {
    throw new Error('无法解析文件内容');
  }

  // 构建实体
  const bookId = uuidv4();
  const now = Date.now();

  const chapterEntities: Chapter[] = chapterParts.map((ch, i) => ({
    id: uuidv4(),
    bookId,
    index: i + 1,
    title: ch.title,
    content: ch.content,
    wordCount: ch.content.replace(/\s/g, '').length,
    status: 'complete' as const,
    createdAt: now,
  }));

  const totalWords = chapterEntities.reduce((s, c) => s + c.wordCount, 0);

  const book: Book = {
    id: bookId,
    title: file.name.replace(/\.txt$/i, ''),
    type: 'local',
    chapterCount: chapterEntities.length,
    totalWordCount: totalWords,
    summary: undefined,
    readingProgress: { chapterIndex: 0, scrollOffset: 0 },
    createdAt: now,
    updatedAt: now,
    lastReadAt: now,
  };

  // 写入数据库
  console.log(`[ImportService] 开始写入数据库: bookId=${bookId}, ${chapterEntities.length} 章`);
  await db.transaction('rw', [db.books, db.chapters], async () => {
    await db.books.add(book);
    console.log(`[ImportService] 书籍已写入: "${book.title}"`);
    await db.chapters.bulkAdd(chapterEntities);
    console.log(`[ImportService] 章节已写入`);
  });

  console.log(
    `[ImportService] 导入成功: "${book.title}", ${chapterEntities.length} 章, ${totalWords} 字`,
  );

  return { book, chapters: chapterEntities };
}

/**
 * 批量导入多个文件
 */
export async function importMultipleBooks(files: File[]): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const result = await importBookFromFile(file);
      results.push(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '未知错误';
      errors.push(`${file.name}: ${errMsg}`);
    }
  }

  if (errors.length > 0) {
    message.warning(`部分文件导入失败:\n${errors.join('\n')}`);
  }

  if (results.length > 0) {
    message.success(`成功导入 ${results.length} 本书`);
  }

  return results;
}

/**
 * 处理拖拽文件导入（从 DragEvent 中提取 .txt 文件）
 */
export function extractTxtFilesFromDragEvent(e: DragEvent): File[] {
  const files: File[] = [];
  const items = e.dataTransfer?.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.kind === 'file') {
        const file = item?.getAsFile();
        if (file && file.name.toLowerCase().endsWith('.txt')) {
          files.push(file);
        }
      }
    }
  }
  return files;
}
