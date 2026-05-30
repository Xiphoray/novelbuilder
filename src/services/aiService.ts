import type { Chapter } from '@/types';

const API_BASE = 'http://localhost:5298/api';

// ============ 日志工具 ============
function logInfo(message: string, data?: unknown) {
  console.log(`[AI Service] ${message}`, data ?? '');
}

function logError(message: string, data?: unknown) {
  console.error(`[AI Service] ❌ ${message}`, data ?? '');
}

// ============ API 调用封装 ============
async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  logInfo(`POST ${endpoint}`, { bodyKeys: Object.keys(body as Record<string, unknown>) });
  const start = Date.now();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const duration = Date.now() - start;
  logInfo(`POST ${endpoint} completed (${duration}ms)`, { code: data.code, message: data.message });

  if (data.code !== 0) {
    throw new Error(data.message || '未知错误');
  }

  return data.data as T;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(data.message || '未知错误');
  }
  return data.data as T;
}

// ============ 类型定义 ============
export interface GenerateRequest {
  style: string | string[];
  userPrompt?: string;
  providerId?: string;
}

export interface GenerateResponse {
  title: string;
  chapters: {
    index: number;
    title: string;
    content: string;
    wordCount: number;
  }[];
  summary: string;
  usage?: unknown;
}

export interface AppendRequest {
  bookId: string;
  bookTitle: string;
  style?: string;
  summary: string;
  recentChapters: {
    index: number;
    title: string;
    content: string;
  }[];
  currentChapterCount: number;
}

export interface AppendResponse {
  chapters: {
    index: number;
    title: string;
    content: string;
    wordCount: number;
  }[];
  usage?: unknown;
}

export interface SummaryRequest {
  bookTitle: string;
  chapters: {
    title: string;
    content: string;
  }[];
}

export interface SummaryResponse {
  summary: string;
  usage?: unknown;
}

export interface ConnectionTestResult {
  success: boolean;
  models?: string[];
  error?: string;
}

// ============ 导出函数 ============

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

/**
 * 测试 API 连接
 */
export async function testConnection(config: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<ConnectionTestResult> {
  return apiPost<ConnectionTestResult>('/test-connection', config);
}

/**
 * 保存 API 配置到后端
 */
export async function saveServerConfig(config: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  name?: string;
  id?: string;
}): Promise<{ id: string; provider: string; baseUrl: string; modelId: string }> {
  return apiPost('/config', config);
}

/**
 * 获取后端配置
 */
export async function getServerConfig() {
  return apiGet('/config');
}

// ============ SSE 流式生成 ============

export interface StreamCallbacks {
  onStart?: (prompt: string) => void;
  onDelta?: (content: string, accumulated: string) => void;
  onDone?: (data: GenerateResponse) => void;
  onError?: (message: string) => void;
}

/**
 * F-005: AI 流式生成小说（SSE）
 */
export async function generateNovelStream(
  request: GenerateRequest,
  callbacks: StreamCallbacks,
): Promise<void> {
  logInfo('=== 开始流式生成小说 ===', { style: request.style, userPrompt: request.userPrompt });

  const response = await fetch(`${API_BASE}/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const payload = JSON.parse(trimmed.slice(6));

        if (payload.type === 'start') {
          callbacks.onStart?.(payload.prompt);
        } else if (payload.type === 'delta') {
          callbacks.onDelta?.(payload.content, '');
        } else if (payload.type === 'done') {
          callbacks.onDone?.(payload.data as GenerateResponse);
        } else if (payload.type === 'error') {
          callbacks.onError?.(payload.message);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  logInfo('=== 流式生成结束 ===');
}

/**
 * F-006: 流式追加生成
 */
export async function appendChaptersStream(
  request: AppendRequest,
  callbacks: StreamCallbacks,
): Promise<void> {
  logInfo('=== 开始流式追加生成 ===', {
    bookId: request.bookId,
    currentChapterCount: request.currentChapterCount,
  });

  const response = await fetch(`${API_BASE}/generate/append/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const payload = JSON.parse(trimmed.slice(6));

        if (payload.type === 'start') {
          callbacks.onStart?.(payload.prompt);
        } else if (payload.type === 'delta') {
          callbacks.onDelta?.(payload.content, '');
        } else if (payload.type === 'done') {
          callbacks.onDone?.(payload.data);
        } else if (payload.type === 'error') {
          callbacks.onError?.(payload.message);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  logInfo('=== 流式追加生成结束 ===');
}
