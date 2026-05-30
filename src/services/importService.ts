import { v4 as uuidv4 } from 'uuid';
import jschardet from 'jschardet';
import { message } from 'antd';
import { db } from './db';
import { CHAPTER_PATTERNS } from '@/types';
import type { Book, Chapter } from '@/types';

/** 导入结果 */
export interface ImportResult {
  book: Book;
  chapters: Chapter[];
}

/** 常见中文编码列表 */
const COMMON_ENCODINGS = ['utf-8', 'gbk', 'gb2312', 'big5', 'gb18030', 'euc-cn'];

/**
 * 检测并解码文件内容
 */
function decodeFileBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  const uint8 = new Uint8Array(buffer);

  // 优先尝试 UTF-8，因为大多数现代文本文件都是 UTF-8 编码
  const utf8Text = tryDecode(uint8, 'utf-8');
  if (utf8Text && !hasGarbledText(utf8Text)) {
    console.log('[ImportService] UTF-8 decode successful');
    return { text: utf8Text, encoding: 'utf-8' };
  }

  // 尝试 jschardet 检测编码
  const detected = jschardet.detect(uint8);
  let encoding = (detected.encoding || 'utf-8').toLowerCase();

  // 标准化编码名称
  encoding = encoding.replace(/[^a-z0-9-]/g, '');
  if (encoding === 'ascii') encoding = 'utf-8';

  // 尝试用检测到的编码解码
  let text = tryDecode(uint8, encoding);

  // 如果解码结果包含大量乱码（替换字符），尝试常见编码
  if (!text || hasGarbledText(text)) {
    console.log(`[ImportService] Encoding ${encoding} failed or has garbled text, trying alternatives...`);
    for (const enc of COMMON_ENCODINGS) {
      if (enc === encoding) continue;
      const candidate = tryDecode(uint8, enc);
      if (candidate && !hasGarbledText(candidate)) {
        text = candidate;
        encoding = enc;
        console.log(`[ImportService] Found working encoding: ${enc}`);
        break;
      }
    }
  }

  // 若仍未找到可读编码，则返回空字符串，让调用方决定是否弹出选择框
  return { text: text || '', encoding };
}

/**
 * 尝试用指定编码解码
 */
function tryDecode(uint8: Uint8Array, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(uint8);
  } catch {
    return '';
  }
}

/**
 * 检测文本是否包含大量乱码（Unicode 替换字符 U+FFFD）
 */
function hasGarbledText(text: string): boolean {
  const sample = text.substring(0, 2000);
  const replacementCount = (sample.match(/\ufffd/g) || []).length;
  return replacementCount > sample.length * 0.05;
}

/**
 * 将文本内容分割成章节
 */
export function splitIntoChapters(
  text: string,
): Array<{ title: string; content: string }> {
  const lines = text.split(/\r?\n/);
  const chapters: Array<{ title: string; content: string }> = [];
  let currentTitle = '第一章';
  let currentContent = '';

  // 跳过开头的空行和元信息
  let startIdx = 0;
  while (startIdx < lines.length && !(lines[startIdx] ?? '').trim()) {
    startIdx++;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line: string = lines[i] ?? '';
    const trimmed = line.trim();

    // 检查是否是章节标题
    const isChapterTitle = trimmed.length > 0 && CHAPTER_PATTERNS.some((p) => p.test(trimmed));

    if (isChapterTitle && currentContent.trim().length > 0) {
      chapters.push({ title: currentTitle, content: currentContent.trim() });
      currentTitle = trimmed;
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }

  // 保存最后一章
  if (currentContent.trim()) {
    chapters.push({ title: currentTitle, content: currentContent.trim() });
  }

  // 如果没有识别到章节，按固定长度分割
  if (chapters.length === 0) {
    return splitByLength(text, 5000);
  }

  // 如果只识别到 1 章且内容很长，尝试按长度分割
  const firstChapter = chapters[0];
  if (chapters.length === 1 && firstChapter && firstChapter.content.length > 10000) {
    return splitByLength(firstChapter.content, 5000);
  }

  return chapters;
}

/**
 * 按固定长度分割文本（在段落边界处分割）
 */
function splitByLength(
  text: string,
  maxLen: number,
): Array<{ title: string; content: string }> {
  const paragraphs = text.split(/\n\s*\n|\r\n\s*\r\n/).filter((p) => p.trim());
  const chapters: Array<{ title: string; content: string }> = [];
  let currentContent = '';
  let chapterNum = 1;

  for (const para of paragraphs) {
    if (currentContent.length + para.length > maxLen && currentContent.length > 0) {
      const title = `第${toChineseNum(chapterNum)}章`;
      chapters.push({
        title,
        content: currentContent.trim(),
      });
      chapterNum++;
      currentContent = para;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

    if (currentContent.trim()) {
    const title = chapters.length > 0 ? `第${toChineseNum(chapterNum)}章` : '全文';
    chapters.push({
      title,
      content: currentContent.trim(),
    });
  }

  return chapters.length > 0 ? chapters : [{ title: '全文', content: text }];
}

/**
 * 数字转中文（简单实现）
 */
function toChineseNum(n: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) {
    if (n === 10) return '十';
    return digits[n] || String(n);
  }
  if (n < 20) return '十' + digits[n - 10];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return digits[tens] + '十' + (ones ? digits[ones] : '');
  }
  return String(n);
}

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
export async function importMultipleBooks(
  files: File[],
): Promise<ImportResult[]> {
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
export function extractTxtFilesFromDragEvent(
  e: DragEvent,
): File[] {
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
