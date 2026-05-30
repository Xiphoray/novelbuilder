/**
 * AI 追加生成 Hook
 */

import { useCallback } from 'react';
import { App } from 'antd';
import { useBookStore } from '@/stores/bookStore';
import { appendChapters, generateSummary } from '@/services/aiService';
import type { Chapter } from '@/types';
import type { useReaderState } from './useReaderState';

export function useAppendGeneration(
  reader: ReturnType<typeof useReaderState>,
) {
  const { message } = App.useApp();
  const {
    currentBook, currentChapters, appendLoading,
    setAppendLoading, setAppendProgress,
  } = reader;

  const handleAppend = useCallback(async () => {
    if (!currentBook || appendLoading) return;
    if (currentBook.type !== 'ai' || !currentBook.aiConfig) return;

    setAppendLoading(true);
    setAppendProgress('正在准备上下文...');

    try {
      const recentChapters = currentChapters.slice(-2).map((ch) => ({
        index: ch.index, title: ch.title, content: ch.content,
      }));

      let summary = currentBook.summary || '';
      if (!summary && currentChapters.length > 2) {
        setAppendProgress('正在生成内容摘要...');
        try {
          const result = await generateSummary({
            bookTitle: currentBook.title,
            chapters: currentChapters.slice(0, -2).map((ch) => ({ title: ch.title, content: ch.content })),
          });
          summary = result.summary;
        } catch (err) { console.warn('[Reader] 摘要生成失败', err); }
      }

      setAppendProgress('AI 正在续写章节...');

      const result = await appendChapters({
        bookId: currentBook.id, bookTitle: currentBook.title,
        style: currentBook.aiConfig.style, summary,
        recentChapters, currentChapterCount: currentChapters.length,
      });

      if (result.chapters.length === 0) { message.warning('AI 未能生成新章节'); return; }

      setAppendProgress('正在保存新章节...');

      const { v4: uuidv4 } = await import('uuid');
      const newChapters: Chapter[] = result.chapters.map((ch) => ({
        id: uuidv4(), bookId: currentBook.id, index: ch.index,
        title: ch.title, content: ch.content, wordCount: ch.wordCount,
        status: 'complete' as const, createdAt: Date.now(),
      }));

      const { appendChapters: storeAppend } = useBookStore.getState();
      await storeAppend(currentBook.id, newChapters);

      message.success(`已续写 ${newChapters.length} 章，共 ${currentChapters.length + newChapters.length} 章`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '追加生成失败');
    } finally {
      setAppendLoading(false);
      setAppendProgress('');
    }
  }, [currentBook, currentChapters, appendLoading, setAppendLoading, setAppendProgress, message]);

  return { handleAppend };
}
