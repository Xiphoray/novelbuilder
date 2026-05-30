/**
 * 章节分割功能
 */

import { CHAPTER_PATTERNS } from '@/types';

export interface ChapterPart {
  title: string;
  content: string;
}

/**
 * 将文本内容分割成章节
 */
export function splitIntoChapters(text: string): ChapterPart[] {
  const lines = text.split(/\r?\n/);
  const chapters: ChapterPart[] = [];
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
function splitByLength(text: string, maxLen: number): ChapterPart[] {
  const paragraphs = text.split(/\n\s*\n|\r\n\s*\r\n/).filter((p) => p.trim());
  const chapters: ChapterPart[] = [];
  let currentContent = '';
  let chapterNum = 1;

  for (const para of paragraphs) {
    if (currentContent.length + para.length > maxLen && currentContent.length > 0) {
      const title = `第${toChineseNum(chapterNum)}章`;
      chapters.push({ title, content: currentContent.trim() });
      chapterNum++;
      currentContent = para;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

  if (currentContent.trim()) {
    const title = chapters.length > 0 ? `第${toChineseNum(chapterNum)}章` : '全文';
    chapters.push({ title, content: currentContent.trim() });
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
