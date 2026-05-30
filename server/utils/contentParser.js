import { log } from './logger.js';

/**
 * 解析 AI 生成的小说内容
 */
export function parseNovelContent(content) {
  log('INFO', 'Parsing novel content', { contentLength: content.length });
  
  const lines = content.split(/\r?\n/);
  let bookTitle = 'AI生成小说';
  
  // 尝试从第一行提取书名
  const firstLine = lines[0]?.trim() || '';
  const titleMatch = firstLine.match(/《(.+?)》/) || firstLine.match(/^[：:]*\s*(.+?)\s*$/);
  if (titleMatch?.[1] && titleMatch[1].length < 50) {
    bookTitle = titleMatch[1].trim();
  }
  
  // 解析章节
  const chapterPattern = /^第[一二三四五六七八九十百千万零\d]+[章节回集部篇]/;
  const chapters = [];
  let currentTitle = '第一章';
  let currentContent = '';
  let startParsing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();
    
    if (chapterPattern.test(trimmed)) {
      if (startParsing && currentContent.trim()) {
        chapters.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = trimmed;
      currentContent = '';
      startParsing = true;
    } else if (startParsing) {
      currentContent += line + '\n';
    } else if (trimmed === '' && !startParsing) {
      // 跳过标题后的空行
      continue;
    }
  }
  
  // 最后一章
  if (currentContent.trim()) {
    chapters.push({ title: currentTitle, content: currentContent.trim() });
  }
  
  // 如果没有识别到章节，把全部内容作为一章
  if (chapters.length === 0) {
    // 跳过第一行（可能是标题）
    const bodyContent = lines.slice(1).join('\n').trim() || content;
    chapters.push({ title: '第一章', content: bodyContent });
  }
  
  log('INFO', 'Parsed novel result', {
    bookTitle,
    chapterCount: chapters.length,
    chapterTitles: chapters.map(c => c.title),
    wordCounts: chapters.map(c => c.content.replace(/\s/g, '').length),
  });
  
  return { bookTitle, chapters };
}
