/**
 * AI 服务相关类型定义
 */

import type { ChapterContent } from '@/types';

export interface GenerateRequest {
  style: string | string[];
  userPrompt?: string;
  providerId?: string;
}

export interface AIChapterResult extends ChapterContent {
  index: number;
  wordCount: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerationMetadata {
  providerId?: string;
  provider?: string;
  modelId?: string;
  durationMs?: number;
}

export interface GenerateResponse {
  title: string;
  chapters: AIChapterResult[];
  summary: string;
  usage?: TokenUsage;
  metadata?: GenerationMetadata;
}

export interface AppendRequest {
  bookId: string;
  bookTitle: string;
  style?: string;
  summary: string;
  recentChapters: Array<ChapterContent & { index: number }>;
  currentChapterCount: number;
}

export interface AppendResponse {
  chapters: AIChapterResult[];
  usage?: TokenUsage;
  metadata?: GenerationMetadata;
}

export interface SummaryRequest {
  bookTitle: string;
  chapters: ChapterContent[];
}

export interface SummaryResponse {
  summary: string;
  usage?: TokenUsage;
  metadata?: GenerationMetadata;
}

export interface ConnectionTestResult {
  success: boolean;
  models?: string[];
  error?: string;
  errorType?: 'validation' | 'auth' | 'not_found' | 'model_not_found' | 'rate_limit' | 'timeout' | 'server' | 'network' | 'unknown';
  status?: number;
  suggestion?: string;
  testedEndpoint?: string;
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
