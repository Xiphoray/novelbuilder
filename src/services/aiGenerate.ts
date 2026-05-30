/**
 * AI 小说生成功能
 */

import { apiPost } from './aiClient';
import type {
  GenerateRequest,
  GenerateResponse,
  AppendRequest,
  AppendResponse,
  SummaryRequest,
  SummaryResponse,
} from './aiTypes';

function logInfo(message: string, data?: unknown) {
  console.log(`[AI Service] ${message}`, data ?? '');
}

/**
 * F-005: AI 首次生成小说（通过后端 API）
 */
export async function generateNovel(request: GenerateRequest): Promise<GenerateResponse> {
  logInfo('=== 开始生成小说 ===', { style: request.style, userPrompt: request.userPrompt });
  const result = await apiPost<GenerateResponse>('/generate', request);
  logInfo('=== 小说生成完成 ===', {
    title: result.title,
    chapterCount: result.chapters.length,
  });
  return result;
}

/**
 * F-006: 追加生成小说章节（通过后端 API）
 */
export async function appendChapters(request: AppendRequest): Promise<AppendResponse> {
  logInfo('=== 开始追加生成 ===', {
    bookId: request.bookId,
    bookTitle: request.bookTitle,
    currentChapterCount: request.currentChapterCount,
    recentChapterCount: request.recentChapters.length,
    summaryLength: request.summary.length,
  });
  const result = await apiPost<AppendResponse>('/generate/append', request);
  logInfo('=== 追加生成完成 ===', {
    newChapterCount: result.chapters.length,
  });
  return result;
}

/**
 * 生成摘要（通过后端 API）
 */
export async function generateSummary(request: SummaryRequest): Promise<SummaryResponse> {
  logInfo('=== 开始生成摘要 ===', {
    bookTitle: request.bookTitle,
    chapterCount: request.chapters.length,
  });
  const result = await apiPost<SummaryResponse>('/generate/summary', request);
  logInfo('=== 摘要生成完成 ===', {
    summaryLength: result.summary.length,
  });
  return result;
}
