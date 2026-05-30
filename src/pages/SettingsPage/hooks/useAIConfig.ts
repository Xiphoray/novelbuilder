/**
 * AI 配置管理 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AIProviderConfig } from '@/types';
import { saveServerConfig, testConnection, getServerConfig } from '@/services/aiService';
import { v4 as uuidv4 } from 'uuid';

interface ModelInfo {
  maxTokens?: number;
  contextLength?: number;
}

export function useAIConfig() {
  const { message } = App.useApp();
  const { aiConfigs, addAIConfig, updateAIConfig, deleteAIConfig } = useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelInfoMap, setModelInfoMap] = useState<Record<string, ModelInfo>>({});

  useEffect(() => {
    import('@/services/aiService').then(({ healthCheck }) => healthCheck()).then((online) => setBackendOnline(online));
  }, []);

  useEffect(() => {
    getServerConfig().then((result) => {
      if (result.providers) {
        const infoMap: Record<string, ModelInfo> = {};
        for (const p of result.providers) {
          if (p.id && (p.maxTokens || p.contextLength)) {
            infoMap[p.id] = { maxTokens: p.maxTokens, contextLength: p.contextLength };
          }
        }
        setModelInfoMap(infoMap);
      }
    }).catch(() => {});
  }, []);

  const syncConfigToServer = useCallback(async (config: AIProviderConfig) => {
    try {
      const result = await saveServerConfig({
        id: config.id,
        name: config.name,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: (config as unknown as { apiKey?: string }).apiKey || '',
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

  const handleSave = async (form: any) => {
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

  const handleEdit = (config: AIProviderConfig, form: any) => {
    setEditingId(config.id);
    form.setFieldsValue(config);
  };

  const handleDelete = async (id: string, form: any) => {
    await deleteAIConfig(id);
    setModelInfoMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (editingId === id) { setEditingId(null); form.resetFields(); }
    message.success('AI 配置已删除');
  };

  const handleSetActive = async (config: AIProviderConfig) => {
    try {
      const { setActiveServerConfig } = await import('@/services/aiService');
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

  const handleTestConnection = async (form: any) => {
    try {
      const values = form.getFieldsValue();
      const { baseUrl, provider, modelId } = values as AIProviderConfig;
      const apiKey = (values as { apiKey?: string }).apiKey;
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
        message.success({ content: `✅ 连接成功！${modelInfo}`, key: loadingKey, duration: 8 });
      } else {
        message.error({ content: `连接失败：${result.error || '未知错误'}`, key: loadingKey, duration: 5 });
      }
    } catch {
      message.error({ content: '连接测试出错', key: 'test' });
    }
  };

  return {
    aiConfigs, editingId, backendOnline, modelInfoMap,
    setEditingId,
    handleSave, handleEdit, handleDelete, handleSetActive, handleTestConnection,
  };
}
