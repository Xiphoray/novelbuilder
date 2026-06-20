/**
 * AI 配置管理
 */

import { apiPost, apiGet, apiDelete } from './aiClient';
import type { ConnectionTestResult, ServerConfigState } from './aiTypes';

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
}): Promise<{
  id: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  maxTokens?: number;
  contextLength?: number;
}> {
  return apiPost('/config', config);
}

/**
 * 获取后端配置
 */
export async function getServerConfig(): Promise<ServerConfigState> {
  return apiGet('/config');
}

/**
 * 设置活跃配置
 */
export async function setActiveServerConfig(providerId: string): Promise<void> {
  await apiPost('/config/activate', { id: providerId });
}

/**
 * 删除后端配置
 */
export async function deleteServerConfig(providerId: string): Promise<void> {
  await apiDelete(`/config/${providerId}`);
}

/**
 * 后端健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}
