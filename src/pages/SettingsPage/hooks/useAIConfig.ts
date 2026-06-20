/**
 * AI 配置管理 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import type { FormInstance } from 'antd';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AIProviderConfig } from '@/types';
import {
  saveServerConfig,
  testConnection,
  getServerConfig,
  healthCheck,
  setActiveServerConfig,
  deleteServerConfig,
} from '@/services/aiConfig';
import { v4 as uuidv4 } from 'uuid';

interface ModelInfo {
  maxTokens?: number;
  contextLength?: number;
}

function formatConnectionErrorMessage(result: {
  error?: string;
  errorType?: string;
  suggestion?: string;
  testedEndpoint?: string;
  status?: number;
}) {
  const parts = [
    result.errorType ? `类型：${result.errorType}` : '',
    typeof result.status === 'number' ? `状态码：${result.status}` : '',
    result.error ? `错误：${result.error}` : '错误：未知错误',
    result.suggestion ? `建议：${result.suggestion}` : '',
    result.testedEndpoint ? `接口：${result.testedEndpoint}` : '',
  ].filter(Boolean);

  return parts.join(' | ');
}

export function useAIConfig() {
  const { message } = App.useApp();
  // 用 selector 单独订阅：避免 store 中其他字段变化（如 readingSettings）触发本 hook 整体重渲染
  // 方法引用在 zustand 中本身是稳定的，但仍走 selector 模式保持一致性
  const aiConfigs = useSettingsStore((s) => s.aiConfigs);
  const addAIConfig = useSettingsStore((s) => s.addAIConfig);
  const updateAIConfig = useSettingsStore((s) => s.updateAIConfig);
  const deleteAIConfig = useSettingsStore((s) => s.deleteAIConfig);
  const replaceAllAIConfigs = useSettingsStore((s) => s.replaceAllAIConfigs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelInfoMap, setModelInfoMap] = useState<Record<string, ModelInfo>>({});

  useEffect(() => {
    healthCheck().then((online) => setBackendOnline(online));
  }, []);

  // 打开设置页时，以后端配置为唯一事实来源，原子替换前端 store
  useEffect(() => {
    (async () => {
      try {
        const result = await getServerConfig();
        if (!result.providers) return;

        // 保留本地已有的 apiKey（后端 GET 不返回 apiKey）
        const { aiConfigs: existing } = useSettingsStore.getState();
        const existingById = new Map(existing.map((c) => [c.id, c]));

        const infoMap: Record<string, ModelInfo> = {};
        const syncedConfigs: AIProviderConfig[] = result.providers
          .filter((p) => p.id)
          .map((p) => {
            if (p.maxTokens || p.contextLength) {
              infoMap[p.id] = { maxTokens: p.maxTokens, contextLength: p.contextLength };
            }
            const prev = existingById.get(p.id);
            return {
              id: p.id,
              name: p.name || prev?.name || `${p.provider} - ${p.modelId}`,
              provider: p.provider as AIProviderConfig['provider'],
              baseUrl: p.baseUrl,
              apiKey: prev?.apiKey || '',
              modelId: p.modelId,
              isActive: p.isActive,  // 后端 activeProviderId 决定，保证唯一
            };
          });

        replaceAllAIConfigs(syncedConfigs);
        setModelInfoMap(infoMap);
      } catch {
        // 静默失败：保持本地状态
      }
    })();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps -- 仅挂载时同步一次

  const syncConfigToServer = useCallback(async (config: AIProviderConfig) => {
    try {
      const result = await saveServerConfig({
        id: config.id,
        name: config.name,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || '',
        modelId: config.modelId,
      });
      if (result.maxTokens || result.contextLength) {
        setModelInfoMap((prev) => ({
          ...prev,
          [config.id]: { maxTokens: result.maxTokens, contextLength: result.contextLength },
        }));
      }
    } catch (err) {
      console.warn('[Settings] Failed to sync config to server:', err);
    }
  }, []);

  const handleSave = async (form: FormInstance<AIProviderConfig>) => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        const prev = useSettingsStore.getState().aiConfigs.find((c) => c.id === editingId);
        const updatedConfig = { ...values, id: editingId, isActive: prev?.isActive ?? false } as AIProviderConfig;
        await updateAIConfig(updatedConfig);
        await syncConfigToServer(updatedConfig);
        message.success('AI 配置已更新');
      } else {
        // 如果是首个配置，保存时自动设为活跃
        const { aiConfigs: existing } = useSettingsStore.getState();
        const shouldBeActive = existing.length === 0;
        const newConfig: AIProviderConfig = {
          ...(values as Omit<AIProviderConfig, 'id' | 'isActive'>),
          id: uuidv4(),
          isActive: shouldBeActive,
        };
        await addAIConfig(newConfig);
        await syncConfigToServer(newConfig);
        message.success(shouldBeActive ? 'AI 配置已添加并设为默认' : 'AI 配置已添加');
      }
      form.resetFields();
      setEditingId(null);
    } catch {
      message.error('请填写完整信息');
    }
  };

  const handleEdit = (config: AIProviderConfig, form: FormInstance<AIProviderConfig>) => {
    setEditingId(config.id);
    form.setFieldsValue(config);
  };

  const handleDelete = async (id: string, form: FormInstance<AIProviderConfig>) => {
    try {
      await deleteServerConfig(id);
    } catch (err) {
      console.warn('[Settings] Failed to delete config from server:', err);
    }
    await deleteAIConfig(id);
    setModelInfoMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (editingId === id) { setEditingId(null); form.resetFields(); }
    message.success('AI 配置已删除');
  };

  const handleSetActive = async (config: AIProviderConfig) => {
    try {
      await setActiveServerConfig(config.id);
      // 原子更新：只有一个 isActive = true
      const configs = useSettingsStore.getState().aiConfigs.map((c) => ({
        ...c,
        isActive: c.id === config.id,
      }));
      replaceAllAIConfigs(configs);
      message.success(`已切换到「${config.name}」`);
    } catch {
      message.error('设置活跃配置失败');
    }
  };

  const handleTestConnection = async (form: FormInstance<AIProviderConfig>) => {
    try {
      const values = form.getFieldsValue();
      const { baseUrl, provider, modelId, apiKey } = values;
      if (!baseUrl || !provider || !apiKey) {
        message.error('请填写 API Base URL、Provider 类型和 API Key');
        return;
      }
      const loadingKey = 'test';
      message.loading({ content: '通过后端测试连接中...', key: loadingKey, duration: 0 });
      const result = await testConnection({ provider, baseUrl, apiKey, modelId: modelId || '' });
      if (result.success) {
        const modelInfo = result.models?.length
          ? `，可用模型 ${result.models.length} 个：${result.models.slice(0, 5).join(', ')}${result.models.length > 5 ? '...' : ''}`
          : '';
        const endpointInfo = result.testedEndpoint ? `，测试接口：${result.testedEndpoint}` : '';
        message.success({ content: `✅ 连接成功！${modelInfo}${endpointInfo}`, key: loadingKey, duration: 8 });
      } else {
        message.error({
          content: `连接失败：${formatConnectionErrorMessage(result)}`,
          key: loadingKey,
          duration: 8,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '连接测试出错';
      message.error({ content: msg, key: 'test', duration: 5 });
    }
  };

  return {
    aiConfigs, editingId, backendOnline, modelInfoMap,
    setEditingId,
    handleSave, handleEdit, handleDelete, handleSetActive, handleTestConnection,
  };
}
