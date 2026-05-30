/**
 * AI 服务相关类型定义
 */

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

export interface ServerProviderConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  isActive: boolean;
  maxTokens?: number;
  contextLength?: number;
}

export interface ServerConfigState {
  isConfigured: boolean;
  activeProviderId: string | null;
  providers: ServerProviderConfig[];
}

export interface StreamCallbacks {
  onStart?: (prompt: string) => void;
  onDelta?: (content: string, accumulated: string) => void;
  onDone?: (data: GenerateResponse) => void;
  onError?: (message: string) => void;
}
