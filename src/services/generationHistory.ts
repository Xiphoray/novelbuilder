import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/db';
import type { GenerationHistory } from '@/types';
import type { TokenUsage, GenerationMetadata } from '@/services/aiTypes';

interface HistoryEntryInput {
  bookId: string;
  type: GenerationHistory['type'];
  prompt: string;
  success: boolean;
  model?: string;
  provider?: string;
  tokenUsage?: TokenUsage;
  error?: string;
  timestamp?: number;
}

export function buildInitialPrompt(styleText: string, userPrompt: string) {
  return [styleText, userPrompt].filter(Boolean).join('，').trim();
}

export function buildAppendPrompt(params: {
  bookTitle: string;
  style?: string;
  summary: string;
  recentChapters: Array<{ index: number; title: string; content: string }>;
  currentChapterCount: number;
}) {
  const { bookTitle, style, summary, recentChapters, currentChapterCount } = params;
  const recentContent = recentChapters
    .map((ch) => `第${ch.index}章 ${ch.title}\n${ch.content}`)
    .join('\n\n');

  return [
    `书名：${bookTitle || '未命名'}`,
    `风格：${style || '未指定'}`,
    `当前章节数：${currentChapterCount}`,
    `摘要：${summary || '暂无摘要'}`,
    `最近章节：\n${recentContent || '无'}`,
  ].join('\n\n');
}

export function resolveModel(metadata?: GenerationMetadata, fallbackModel?: string) {
  return metadata?.modelId || fallbackModel || 'unknown';
}

export function resolveProvider(metadata?: GenerationMetadata, fallbackProvider?: string) {
  return metadata?.provider || fallbackProvider || 'unknown';
}

export function truncateError(error: unknown, maxLength = 500) {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
}

export async function addGenerationHistoryEntry(input: HistoryEntryInput) {
  await db.generationHistory.add({
    id: uuidv4(),
    bookId: input.bookId,
    type: input.type,
    prompt: input.prompt,
    model: input.model || 'unknown',
    provider: input.provider || 'unknown',
    tokenUsage: input.tokenUsage,
    timestamp: input.timestamp || Date.now(),
    success: input.success,
    error: input.error,
  });
}
