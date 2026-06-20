/**
 * AI 小说生成 Hook
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { App } from 'antd';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { db } from '@/services/db';
import type { Book, Chapter } from '@/types';
import { generateNovelStream, generateSummary } from '@/services/aiService';
import {
  addGenerationHistoryEntry,
  buildInitialPrompt,
  resolveModel,
  resolveProvider,
  truncateError,
} from '@/services/generationHistory';

interface UseGenerateNovelReturn {
  generating: boolean;
  progress: string;
  elapsedTime: number;
  cancelGenerate: () => void;
  handleGenerate: (
    selectedTags: string[],
    customPrompt: string,
    onClose: () => void,
    resetForm: () => void,
  ) => Promise<void>;
}

export function useGenerateNovel(): UseGenerateNovelReturn {
  const { message } = App.useApp();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const cancelGenerate = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 组件卸载时自动中止
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const addBook = useBookStore((s) => s.addBook);
  const openBook = useBookStore((s) => s.openBook);
  const activeAIConfig = useSettingsStore((s) => s.activeAIConfig);

  const handleGenerate = async (
    selectedTags: string[],
    customPrompt: string,
    onClose: () => void,
    resetForm: () => void,
  ) => {
    if (!activeAIConfig) {
      message.error('请先在设置中配置 AI Provider');
      return;
    }

    const styleText = selectedTags.join('、');
    const fullPrompt = [styleText, customPrompt].filter(Boolean).join('，');

    if (!fullPrompt.trim()) {
      message.error('请选择风格类型或输入描述');
      return;
    }

    setGenerating(true);
    setProgress('正在连接 AI 服务...');
    setElapsedTime(0);

    const controller = new AbortController();
    abortRef.current = controller;

    // 计时器
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      let streamResult: import('@/services/aiTypes').GenerateResponse | undefined;
      const initialPrompt = buildInitialPrompt(styleText, customPrompt);

      // 流式生成
      setProgress('AI 正在创作中，内容将实时展示...');
      await generateNovelStream(
        { style: selectedTags, userPrompt: customPrompt || undefined },
        {
          onStart: () => setProgress('AI 已收到请求，开始创作...'),
          // 预取消内容预览：仅按需用于完成后的保存，此处不保留中间内容
          onDelta: () => undefined,
          onDone: (data) => { streamResult = data; },
          onError: (msg) => { throw new Error(msg); },
        },
        { signal: controller.signal },
      );

      if (!streamResult) throw new Error('生成失败：未收到结果');

      setProgress('正在保存到本地数据库...');

      const bookId = uuidv4();
      const now = Date.now();
      const chapterEntities: Chapter[] = streamResult.chapters.map((ch) => ({
        id: uuidv4(),
        bookId,
        index: ch.index,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
        status: 'complete' as const,
        createdAt: now,
      }));

      const book: Book = {
        id: bookId,
        title: streamResult.title,
        type: 'ai',
        chapterCount: streamResult.chapters.length,
        totalWordCount: chapterEntities.reduce((s, c) => s + c.wordCount, 0),
        summary: streamResult.summary || fullPrompt,
        readingProgress: { chapterIndex: 0, scrollOffset: 0 },
        createdAt: now,
        updatedAt: now,
        lastReadAt: now,
        aiConfig: {
          providerId: activeAIConfig.id,
          modelId: activeAIConfig.modelId,
          style: styleText,
          userPrompt: customPrompt,
        },
      };

      await addBook(book, chapterEntities);
      await addGenerationHistoryEntry({
        bookId,
        type: 'initial',
        prompt: initialPrompt,
        success: true,
        model: resolveModel(streamResult.metadata, activeAIConfig.modelId),
        provider: resolveProvider(streamResult.metadata, activeAIConfig.provider),
        tokenUsage: streamResult.usage,
        timestamp: now,
      });
      await openBook(bookId);

      // 异步压缩概括
      (async () => {
        const summaryPrompt = `书名：${streamResult.title}\n章节数：${streamResult.chapters.length}`;
        try {
          const summaryResult = await generateSummary({
            bookTitle: streamResult.title,
            chapters: streamResult.chapters,
          });
          const bookInDb = await db.books.get(bookId);
          if (bookInDb) {
            await db.books.update(bookId, { summary: summaryResult.summary });
            const { currentBook } = useBookStore.getState();
            if (currentBook?.id === bookId) {
              useBookStore.setState({
                currentBook: { ...currentBook, summary: summaryResult.summary },
              });
            }
          }

          await addGenerationHistoryEntry({
            bookId,
            type: 'summary',
            prompt: summaryPrompt,
            success: true,
            model: resolveModel(summaryResult.metadata, activeAIConfig.modelId),
            provider: resolveProvider(summaryResult.metadata, activeAIConfig.provider),
            tokenUsage: summaryResult.usage,
          });
        } catch (summaryError) {
          await addGenerationHistoryEntry({
            bookId,
            type: 'summary',
            prompt: summaryPrompt,
            success: false,
            model: activeAIConfig.modelId,
            provider: activeAIConfig.provider,
            error: truncateError(summaryError),
          });
        }
      })();

      message.success(`《${streamResult.title}》生成完毕，共 ${streamResult.chapters.length} 章`);
      resetForm();
      onClose();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const rawMsg = err instanceof Error ? err.message : '生成失败，请重试';
      const errorMsg = isAbort ? '用户已取消生成' : rawMsg;
      if (isAbort) {
        message.info('已取消生成');
      } else {
        message.error(errorMsg);
      }
      await addGenerationHistoryEntry({
        bookId: `failed:${Date.now()}`,
        type: 'initial',
        prompt: buildInitialPrompt(styleText, customPrompt),
        success: false,
        model: activeAIConfig.modelId,
        provider: activeAIConfig.provider,
        error: truncateError(errorMsg),
      });
    } finally {
      clearInterval(timer);
      abortRef.current = null;
      setGenerating(false);
      setProgress('');
    }
  };

  return { generating, progress, elapsedTime, cancelGenerate, handleGenerate };
}
