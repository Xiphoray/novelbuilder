import type { Book, Chapter } from '@/types';

/**
 * 格式化字数显示（如 125000 → "12.5万字"）
 */
export function formatWordCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万字`;
  }
  return `${count}字`;
}

/**
 * 格式化相对时间（如 "3分钟前"、"昨天"）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < 2 * day) {
    return '昨天';
  } else if (diff < month) {
    return `${Math.floor(diff / day)}天前`;
  } else if (diff < 12 * month) {
    return `${Math.floor(diff / month)}个月前`;
  } else {
    return `${Math.floor(diff / (12 * month))}年前`;
  }
}

/**
 * 导出书籍为 TXT 文件并触发浏览器下载
 */
export function exportBookAsTxt(book: Book, chapters: Chapter[]): void {
  if (chapters.length === 0) {
    return;
  }

  // 构建 TXT 内容
  const lines: string[] = [];
  lines.push(`《${book.title}》`);
  lines.push('');

  for (const chapter of chapters.sort((a, b) => a.index - b.index)) {
    lines.push('');
    lines.push(chapter.title);
    lines.push('');
    lines.push(chapter.content);
  }

  const text = lines.join('\n');

  // 创建 Blob 并触发下载
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${book.title}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
