/**
 * AI 服务入口
 * 统一导出各子模块的功能
 */

// 类型导出
export type {
  GenerateRequest,
  GenerateResponse,
  AppendRequest,
  AppendResponse,
  SummaryRequest,
  SummaryResponse,
  ConnectionTestResult,
  ServerProviderConfig,
  ServerConfigState,
  StreamCallbacks,
} from './aiTypes';

// 生成相关
export { generateNovel, appendChapters, generateSummary } from './aiGenerate';

// 流式生成
export { generateNovelStream, appendChaptersStream } from './aiStream';

// 配置管理
export { testConnection, saveServerConfig, getServerConfig, setActiveServerConfig, healthCheck } from './aiConfig';
