/**
 * AI API 客户端封装
 */

const API_BASE = '/api';

// ============ 日志工具 ============
function logInfo(message: string, data?: unknown) {
  console.log(`[AI Service] ${message}`, data ?? '');
}

// ============ API 调用封装 ============
export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
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

export async function apiGet<T>(endpoint: string): Promise<T> {
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

// ============ SSE 流读取工具 ============
export type { StreamCallbacks } from './aiTypes';
export type { GenerateResponse } from './aiTypes';

/**
 * 通用 SSE 流处理器
 */
export async function readSSE(
  endpoint: string,
  body: unknown,
  callbacks: import('./aiTypes').StreamCallbacks,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取流');

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  try {
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
            accumulated += payload.content || '';
            callbacks.onDelta?.(payload.content, accumulated);
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
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('用户已取消生成');
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
