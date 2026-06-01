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
  const { aiConfigs, addAIConfig, updateAIConfig, deleteAIConfig } = useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelInfoMap, setModelInfoMap] = useState<Record<string, ModelInfo>>({});

  useEffect(() => {
    healthCheck().then((online) => setBackendOnline(online));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await getServerConfig();
        if (!result.providers) return;
        const infoMap: Record<string, ModelInfo> = {};
        const { aiConfigs: existing } = useSettingsStore.getState();
        const existingById = new Map(existing.map((c) => [c.id, c]));

        for (const p of result.providers) {
          if (!p.id) continue;
          if (p.maxTokens || p.contextLength) {
            infoMap[p.id] = { maxTokens: p.maxTokens, contextLength: p.contextLength };
          }
          // 同步后端 provider 到本地 store：后端是事实来源，丢失的本地记录以空 apiKey 占位
          const prev = existingById.get(p.id);
          const synced: AIProviderConfig = {
            id: p.id,
            name: p.name || prev?.name || `${p.provider} - ${p.modelId}`,
            provider: p.provider as AIProviderConfig['provider'],
            baseUrl: p.baseUrl,
            apiKey: prev?.apiKey || '',
            modelId: p.modelId,
            isActive: p.isActive || prev?.isActive || false,
          };
          if (prev) {
            await updateAIConfig(synced);
          } else {
            await addAIConfig(synced);
          }
        }
        setModelInfoMap(infoMap);
      } catch {
        // 静默失败：保持本地状态
      }
    })();
  }, [addAIConfig, updateAIConfig]);

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
        const updatedConfig = { ...values, id: editingId } as AIProviderConfig;
        await updateAIConfig(updatedConfig);
        await syncConfigToServer(updatedConfig);
        message.success('AI 配置已更新');
      } else {
        const newConfig: AIProviderConfig = { ...(values as Omit<AIProviderConfig, 'id'>), id: uuidv4() };
        await addAIConfig(newConfig);
        await syncConfigToServer(newConfig);
        message.success('AI 配置已添加');
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
    await deleteAIConfig(id);
    setModelInfoMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (editingId === id) { setEditingId(null); form.resetFields(); }
    message.success('AI 配置已删除');
  };

  const handleSetActive = async (config: AIProviderConfig) => {
    try {
      await setActiveServerConfig(config.id);
      const { aiConfigs: configs } = useSettingsStore.getState();
      for (const c of configs) {
        if (c.id === config.id) await updateAIConfig({ ...c, isActive: true });
        else if (c.isActive) await updateAIConfig({ ...c, isActive: false });
      }
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
