import express from 'express';
import { log } from '../utils/logger.js';
import { getConfigStore, setConfigStore, saveConfig } from '../utils/configStore.js';
import { fetchModelInfo, calcMaxOutputTokens } from '../utils/aiClient.js';

const router = express.Router();

// 获取配置
router.get('/api/config', (req, res) => {
  const configStore = getConfigStore();
  const { activeProviderId, providers } = configStore;
  const activeProvider = providers.find(p => p.id === activeProviderId);
  
  res.json({
    code: 0,
    message: 'success',
    data: {
      isConfigured: !!activeProvider,
      activeProviderId,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        baseUrl: p.baseUrl,
        modelId: p.modelId,
        isActive: p.id === activeProviderId,
      })),
    },
  });
});

// 保存配置（自动查询模型 max_tokens）
router.post('/api/config', async (req, res) => {
  const { provider, baseUrl, apiKey, modelId, name, id } = req.body;
  const configStore = getConfigStore();
  
  if (!provider || !baseUrl || !apiKey || !modelId) {
    return res.json({ code: 40003, message: '请填写完整配置', data: null });
  }
  
  const providerId = id || `provider_${Date.now()}`;
  const existingIndex = configStore.providers.findIndex(p => p.id === providerId);
  
  // 自动查询模型信息
  const modelInfo = await fetchModelInfo({ baseUrl, apiKey, modelId, provider });
  
  // 根据模型信息计算合理的最大输出 token 数
  const maxOutputTokens = calcMaxOutputTokens(modelInfo);
  
  const providerConfig = {
    id: providerId,
    name: name || `${provider} - ${modelId}`,
    provider,
    baseUrl,
    apiKey,
    modelId,
    maxTokens: maxOutputTokens,
    contextLength: modelInfo?.contextLength || null,
  };
  
  if (existingIndex >= 0) {
    configStore.providers[existingIndex] = providerConfig;
  } else {
    configStore.providers.push(providerConfig);
  }
  
  if (!configStore.activeProviderId) {
    configStore.activeProviderId = providerId;
  }
  
  saveConfig(configStore);
  
  log('INFO', `Config saved: ${providerId}`, {
    provider, baseUrl, modelId,
    maxTokens: providerConfig.maxTokens,
    contextLength: providerConfig.contextLength,
    maxTokensSource: modelInfo ? 'auto-detected' : 'default',
  });
  
  res.json({
    code: 0,
    message: 'success',
    data: {
      id: providerId,
      provider,
      baseUrl,
      modelId,
      maxTokens: providerConfig.maxTokens,
      contextLength: providerConfig.contextLength,
    },
  });
});

// 设置活跃配置
router.post('/api/config/activate', (req, res) => {
  const { id } = req.body;
  const configStore = getConfigStore();
  const provider = configStore.providers.find(p => p.id === id);
  
  if (!provider) {
    return res.json({ code: 40003, message: '配置不存在', data: null });
  }
  
  configStore.activeProviderId = id;
  saveConfig(configStore);
  
  log('INFO', `Active config set: ${id}`);
  
  res.json({ code: 0, message: 'success', data: { id } });
});

// 删除配置
router.delete('/api/config/:id', (req, res) => {
  const { id } = req.params;
  const configStore = getConfigStore();
  configStore.providers = configStore.providers.filter(p => p.id !== id);
  
  if (configStore.activeProviderId === id) {
    configStore.activeProviderId = configStore.providers[0]?.id || null;
  }
  
  saveConfig(configStore);
  log('INFO', `Config deleted: ${id}`);
  
  res.json({ code: 0, message: 'success', data: null });
});

// 测试连接
router.post('/api/test-connection', async (req, res) => {
  const { provider, baseUrl, apiKey, modelId } = req.body;
  
  if (!provider || !baseUrl || !apiKey) {
    return res.json({ code: 40003, message: '请填写完整配置', data: null });
  }
  
  log('INFO', `Testing connection: ${provider}`, { baseUrl, modelId });
  
  try {
    let testUrl, headers;
    
    if (provider === 'anthropic') {
      testUrl = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      
      const testBody = {
        model: modelId || 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      };
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(testBody),
      });
      
      if (response.ok) {
        const data = await response.json();
        log('INFO', 'Anthropic connection test succeeded');
        res.json({
          code: 0,
          message: 'success',
          data: { success: true, models: [modelId || 'claude-3-haiku-20240307'] },
        });
      } else {
        const errText = await response.text();
        log('ERROR', 'Anthropic connection test failed', { status: response.status, body: errText.slice(0, 500) });
        res.json({
          code: 0,
          message: 'success',
          data: { success: false, error: `${response.status}: ${errText.slice(0, 200)}` },
        });
      }
    } else {
      testUrl = `${baseUrl.replace(/\/+$/, '')}/models`;
      headers = {
        'Authorization': `Bearer ${apiKey}`,
      };
      
      const response = await fetch(testUrl, { method: 'GET', headers });
      
      if (response.ok) {
        const data = await response.json();
        const models = (data.data || []).map(m => m.id).filter(Boolean);
        log('INFO', 'OpenAI connection test succeeded', { modelCount: models.length });
        res.json({
          code: 0,
          message: 'success',
          data: { success: true, models },
        });
      } else {
        const errText = await response.text();
        log('ERROR', 'OpenAI connection test failed', { status: response.status, body: errText.slice(0, 500) });
        res.json({
          code: 0,
          message: 'success',
          data: { success: false, error: `${response.status}: ${errText.slice(0, 200)}` },
        });
      }
    }
  } catch (error) {
    log('ERROR', 'Connection test error', { error: error.message });
    res.json({
      code: 0,
      message: 'success',
      data: { success: false, error: error.message },
    });
  }
});

export default router;
