/** 书籍类型 */
export type BookType = 'local' | 'ai';

/** 书籍状态 */
export type BookStatus = 'reading' | 'unread' | 'finished';

/** 章节状态 */
export type ChapterStatus = 'complete' | 'generating' | 'failed';

/** AI Provider类型 */
export type AIProviderType = 'openai' | 'openai-compatible' | 'anthropic';

/** 主题类型 */
export type ThemeType = 'light' | 'dark' | 'eye-care';

/** 阅读进度 */
export interface ReadingProgress {
  chapterIndex: number;
  scrollOffset: number;
}

/** AI配置信息 */
export interface AIBookConfig {
  providerId: string;
  modelId: string;
  style: string;
  userPrompt?: string;
}

/** 书籍 */
export interface Book {
  id: string;
  title: string;
  type: BookType;
  chapterCount: number;
  totalWordCount: number;
  summary?: string;
  readingProgress: ReadingProgress;
  createdAt: number;
  updatedAt: number;
  lastReadAt?: number;
  aiConfig?: AIBookConfig;
}

/** 章节 */
export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  content: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: number;
}

/** AI Provider配置 */
export interface AIProviderConfig {
  id: string;
  name: string;
  provider: AIProviderType;
  baseUrl: string;
  modelId: string;
  isActive: boolean;
}

/** 排版设置 */
export interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  theme: ThemeType;
  contentWidth: number;
}

/** 生成历史 */
export interface GenerationHistory {
  id: string;
  bookId: string;
  type: 'initial' | 'append' | 'summary';
  prompt: string;
  model: string;
  provider: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  success: boolean;
  error?: string;
}

/** API响应 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 生成请求参数 */
export interface GenerateRequest {
  type: 'initial' | 'append' | 'summary';
  style?: string;
  userPrompt?: string;
  bookId?: string;
  summary?: string;
  recentChapters?: Array<{
    index: number;
    title: string;
    content: string;
  }>;
  currentChapterCount?: number;
}

/** 生成响应 */
export interface GenerateResponse {
  title?: string;
  chapters: Array<{
    index: number;
    title: string;
    content: string;
  }>;
}

/** 默认排版设置 */
export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: '-apple-system, "Microsoft YaHei", sans-serif',
  theme: 'light',
  contentWidth: 800,
};

/** 热门风格标签 */
export const HOT_STYLE_TAGS = [
  '玄幻',
  '仙侠',
  '都市',
  '科幻',
  '悬疑',
  '言情',
  '历史',
  '末日',
  '校园',
  '无限流',
  '系统流',
] as const;

/** 章节分割正则 */
export const CHAPTER_PATTERNS = [
  /^第[一二三四五六七八九十百千万零\d]+[章节回集部篇]/m,
  /^第\s*\d+\s*[章节回集部篇]/m,
  /^Chapter\s+\d+/im,
  /^CHAPTER\s+\d+/m,
];
