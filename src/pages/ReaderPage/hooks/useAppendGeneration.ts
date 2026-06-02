/**
 * AI 追加生成 Hook
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { useBookStore } from '@/stores/bookStore';
import { db } from '@/services/db';
import { appendChaptersStream, generateSummary } from '@/services/aiService';
import type { AppendRequest, AppendResponse } from '@/services/aiTypes';
import type { Chapter } from '@/types';
import {
  addGenerationHistoryEntry,
  buildAppendPrompt,
  resolveModel,
  resolveProvider,
  truncateError,
} from '@/services/generationHistory';
import type { useReaderState } from './useReaderState';

type AppendStatus = 'idle' | 'generating' | 'error' | 'cancelled';

export function useAppendGeneration(
  reader: ReturnType<typeof useReaderState>,
) {
  const { message } = App.useApp();
  const {
    currentBook, currentChapters, currentChapterIndex, appendLoading,
    canAppend, setAppendLoading, setAppendProgress,
  } = reader;

  const [appendStatus, setAppendStatus] = useState<AppendStatus>('idle');
  const [lastError, setLastError] = useState('');
  const [hasLastRequest, setHasLastRequest] = useState(false);
  const autoAppendKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<AppendRequest | null>(null);

  const buildAppendRequest = useCallback(async (): Promise<AppendRequest | null> => {
    if (!currentBook || currentBook.type !== 'ai' || !currentBook.aiConfig) return null;

    const recentChapters = currentChapters.slice(-2).map((ch) => ({
      index: ch.index,
      title: ch.title,
      content: ch.content,
    }));

    let summary = currentBook.summary || '';
    if (!summary && currentChapters.length > 2) {
      setAppendProgress('正在生成内容摘要...');
      try {
        const result = await generateSummary({
          bookTitle: currentBook.title,
          chapters: currentChapters.slice(0, -2).map((ch) => ({
            title: ch.title,
            content: ch.content,
          })),
        });
        summary = result.summary;
      } catch (err) {
        console.warn('[Reader] 摘要生成失败', err);
      }
    }

    return {
      bookId: currentBook.id,
      bookTitle: currentBook.title,
      style: currentBook.aiConfig.style,
      summary,
      recentChapters,
      currentChapterCount: currentChapters.length,
    };
  }, [currentBook, currentChapters, setAppendProgress]);

  const persistNewChapters = useCallback(async (
    result: AppendResponse,
    request: AppendRequest,
    options?: { silent?: boolean },
  ) => {
    if (!currentBook) return;

    if (result.chapters.length === 0) {
      message.warning('AI 未能生成新章节');
      return;
    }

    setAppendProgress('正在保存新章节...');

    const now = Date.now();
    const newChapters: Chapter[] = result.chapters.map((ch) => ({
      id: uuidv4(),
      bookId: currentBook.id,
      index: ch.index,
      title: ch.title,
      content: ch.content,
      wordCount: ch.wordCount,
      status: 'complete' as const,
      createdAt: now,
    }));

    const { appendChapters: storeAppend, currentBook: latestCurrentBook } = useBookStore.getState();
    await storeAppend(currentBook.id, newChapters);

    const allChaptersForSummary = [...currentChapters, ...newChapters].map((ch) => ({
      title: ch.title,
      content: ch.content,
    }));

    void (async () => {
      const summaryPrompt = `书名：${request.bookTitle}\n章节数：${allChaptersForSummary.length}`;
      try {
        const summaryResult = await generateSummary({
          bookTitle: request.bookTitle,
          chapters: allChaptersForSummary,
        });
        await db.books.update(request.bookId, { summary: summaryResult.summary });

        const refreshedBook = latestCurrentBook?.id === request.bookId
          ? { ...latestCurrentBook, summary: summaryResult.summary }
          : null;

        if (refreshedBook) {
          useBookStore.setState({ currentBook: refreshedBook });
        }

        await addGenerationHistoryEntry({
          bookId: request.bookId,
          type: 'summary',
          prompt: summaryPrompt,
          success: true,
          model: resolveModel(summaryResult.metadata, currentBook.aiConfig?.modelId),
          provider: resolveProvider(summaryResult.metadata, currentBook.aiConfig?.providerId),
          tokenUsage: summaryResult.usage,
        });
      } catch (err) {
        console.warn('[Reader] 追加生成后的摘要更新失败', err);
        await addGenerationHistoryEntry({
          bookId: request.bookId,
          type: 'summary',
          prompt: summaryPrompt,
          success: false,
          model: currentBook.aiConfig?.modelId,
          provider: currentBook.aiConfig?.providerId,
          error: truncateError(err),
        });
      }
    })();

    setAppendStatus('idle');
    setLastError('');

    if (!options?.silent) {
      message.success(`已续写 ${newChapters.length} 章，共 ${request.currentChapterCount + newChapters.length} 章`);
    }
  }, [currentBook, currentChapters, message, setAppendProgress]);

  const runAppend = useCallback(async (
    request: AppendRequest,
    options?: { silent?: boolean },
  ) => {
    if (!currentBook || appendLoading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    lastRequestRef.current = request;
    setHasLastRequest(true);

    setAppendLoading(true);
    setAppendStatus('generating');
    setLastError('');
    setAppendProgress('AI 正在续写章节...');

    let streamResult: AppendResponse | undefined;
    const historyPrompt = buildAppendPrompt({
      bookTitle: request.bookTitle,
      style: request.style,
      summary: request.summary,
      recentChapters: request.recentChapters,
      currentChapterCount: request.currentChapterCount,
    });

    try {
      await appendChaptersStream(
        request,
        {
          onStart: () => setAppendProgress('AI 已收到请求，开始续写...'),
          onDelta: () => {
            setAppendProgress('AI 正在续写章节...');
          },
          onDone: (data) => {
            streamResult = data as AppendResponse;
          },
          onError: (msg) => {
            throw new Error(msg);
          },
        },
        { signal: controller.signal },
      );

      if (!streamResult) {
        throw new Error('追加生成失败：未收到结果');
      }

      await persistNewChapters(streamResult, request, options);
      await addGenerationHistoryEntry({
        bookId: request.bookId,
        type: 'append',
        prompt: historyPrompt,
        success: true,
        model: resolveModel(streamResult.metadata, currentBook.aiConfig?.modelId),
        provider: resolveProvider(streamResult.metadata, currentBook.aiConfig?.providerId),
        tokenUsage: streamResult.usage,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '追加生成失败';

      if (errorMsg === '用户已取消生成') {
        setAppendStatus('cancelled');
        setLastError('');
        setAppendProgress('已停止续写');
        await addGenerationHistoryEntry({
          bookId: request.bookId,
          type: 'append',
          prompt: historyPrompt,
          success: false,
          model: currentBook.aiConfig?.modelId,
          provider: currentBook.aiConfig?.providerId,
          error: '用户已取消生成',
        });
        if (!options?.silent) {
          message.info('已停止续写');
        }
      } else {
        setAppendStatus('error');
        setLastError(errorMsg);
        setAppendProgress(errorMsg);
        await addGenerationHistoryEntry({
          bookId: request.bookId,
          type: 'append',
          prompt: historyPrompt,
          success: false,
          model: currentBook.aiConfig?.modelId,
          provider: currentBook.aiConfig?.providerId,
          error: truncateError(errorMsg),
        });
        if (!options?.silent) {
          message.error(errorMsg);
        }
      }
    } finally {
      abortControllerRef.current = null;
      setAppendLoading(false);
    }
  }, [appendLoading, currentBook, message, persistNewChapters, setAppendLoading, setAppendProgress]);

  const handleAppend = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentBook || appendLoading) return;
    if (currentBook.type !== 'ai' || !currentBook.aiConfig) return;

    setAppendProgress('正在准备上下文...');
    const request = await buildAppendRequest();
    if (!request) return;

    await runAppend(request, options);
  }, [appendLoading, buildAppendRequest, currentBook, runAppend, setAppendProgress]);

  const cancelAppend = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const retryAppend = useCallback(async () => {
    const lastRequest = lastRequestRef.current;
    if (!lastRequest || appendLoading) return;
    await runAppend(lastRequest);
  }, [appendLoading, runAppend]);

  useEffect(() => {
    setAppendStatus('idle');
    setLastError('');
    lastRequestRef.current = null;
    setHasLastRequest(false);
    abortControllerRef.current = null;
  }, [currentBook?.id]);

  useEffect(() => {
    if (!currentBook || currentBook.type !== 'ai' || !currentBook.aiConfig) {
      autoAppendKeyRef.current = null;
      return;
    }

    const isLastChapter = currentChapterIndex >= currentChapters.length - 1;
    if (!isLastChapter || !canAppend || appendLoading) {
      return;
    }

    const triggerKey = `${currentBook.id}:${currentChapters.length}`;
    if (autoAppendKeyRef.current === triggerKey) {
      return;
    }

    autoAppendKeyRef.current = triggerKey;
    void handleAppend({ silent: true });
  }, [
    currentBook,
    currentChapters.length,
    currentChapterIndex,
    canAppend,
    appendLoading,
    handleAppend,
  ]);

  return {
    handleAppend,
    cancelAppend,
    retryAppend,
    appendStatus,
    appendError: lastError,
    canRetry: hasLastRequest && !appendLoading,
  };
}
