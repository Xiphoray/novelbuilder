/**
 * AI 流式生成功能 (SSE)
 */

import { readSSE } from './aiClient';
import type { GenerateRequest, AppendRequest, StreamCallbacks } from './aiTypes';

function logInfo(message: string, data?: unknown) {
  console.log(`[AI Service] ${message}`, data ?? '');
}

export async function generateNovelStream(
  request: GenerateRequest,
  callbacks: StreamCallbacks,
  options?: { signal?: AbortSignal },
): Promise<void> {
  logInfo('=== 开始流式生成小说 ===', { style: request.style, userPrompt: request.userPrompt });
  await readSSE('/generate/stream', request, callbacks, options);
  logInfo('=== 流式生成结束 ===');
}

export async function appendChaptersStream(
  request: AppendRequest,
  callbacks: StreamCallbacks,
  options?: { signal?: AbortSignal },
): Promise<void> {
  logInfo('=== 开始流式追加生成 ===', {
    bookId: request.bookId,
    currentChapterCount: request.currentChapterCount,
  });
  await readSSE('/generate/append/stream', request, callbacks, options);
  logInfo('=== 流式追加生成结束 ===');
}
