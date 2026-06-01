import express from 'express';
import { log } from '../utils/logger.js';
import { getConfigStore, setConfigStore, saveConfig, setApiKey, removeApiKey } from '../utils/configStore.js';
import { fetchModelInfo, calcMaxOutputTokens } from '../utils/aiClient.js';

const router = express.Router();

function buildConnectionErrorResult({ status, error, testedEndpoint, provider, modelId }) {
  const normalizedError = (error || '').trim();
  const lowerError = normalizedError.toLowerCase();

  let errorType = 'unknown';
  let suggestion = '请检查 API Base URL、模型 ID 和 API Key 后重试。';

  if (!status && (lowerError.includes('fetch failed') || lowerError.includes('network') || lowerError.includes('econnrefused') || lowerError.includes('enotfound'))) {
    errorType = 'network';
    suggestion = '无法连接到目标服务，请检查 Base URL、网络连通性或代理设置。';
  } else if (!status && (lowerError.includes('timeout') || lowerError.includes('aborted'))) {
    errorType = 'timeout';
    suggestion = '请求超时，请稍后重试，或检查服务响应速度。';
  } else if (status === 400) {
    errorType = modelId ? 'model_not_found' : 'validation';
    suggestion = modelId
      ? '模型 ID 可能不存在或当前接口不支持该模型，请确认模型名称。'
      : '请求参数有误，请检查 Provider、Base URL 和模型设置。';
  } else if (status === 401 || status === 403) {
    errorType = 'auth';
    suggestion = 'API Key 无效、已过期，或当前账号无权限访问该接口。';
  } else if (status === 404) {
    errorType = 'not_found';
    suggestion = provider === 'anthropic'
      ? 'Anthropic 接口地址可能不正确，通常应指向服务根地址而非 /v1/messages。'
      : 'Base URL 可能不正确，请确认其是否已包含正确的 API 根路径。';
  } else if (status === 408) {
    errorType = 'timeout';
    suggestion = '请求超时，请稍后重试，或检查服务响应速度。';
  } else if (status === 429) {
    errorType = 'rate_limit';
    suggestion = '触发了限流，请稍后重试，或检查配额与并发限制。';
  } else if (status && status >= 500) {
    errorType = 'server';
    suggestion = '上游 AI 服务暂时异常，请稍后重试。';
  }

  return {
    success: false,
    error: normalizedError || '未知错误',
    errorType,
    status,
    suggestion,
    testedEndpoint,
  };
}

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
    modelId,
    maxTokens: maxOutputTokens,
    contextLength: modelInfo?.contextLength || null,
  };

  // 敏感字段：仅当请求中提供了非空 apiKey 时才覆盖原密文。
  // 这样首次同步后端 provider 到本地 store 时（未携带 apiKey）不会抹掉密文。
  if (apiKey) {
    setApiKey(providerId, apiKey);
  }

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

  // 同步清除密文
  removeApiKey(id);

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
  const normalizedBaseUrl = baseUrl?.replace(/\/+$/, '');
  
  
  if (!provider || !baseUrl || !apiKey) {
    return res.json({ code: 40003, message: '请填写完整配置', data: null });
  }
  
  log('INFO', `Testing connection: ${provider}`, { baseUrl, modelId });
  
  try {
    let testUrl, headers;
    
    if (provider === 'anthropic') {
      testUrl = `${normalizedBaseUrl}/v1/messages`;
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
          data: {
            success: true,
            models: [modelId || 'claude-3-haiku-20240307'],
            testedEndpoint: testUrl,
          },
        });
      } else {
        const errText = await response.text();
        log('ERROR', 'Anthropic connection test failed', { status: response.status, body: errText.slice(0, 500) });
        res.json({
          code: 0,
          message: 'success',
          data: buildConnectionErrorResult({
            status: response.status,
            error: `${response.status}: ${errText.slice(0, 200)}`,
            testedEndpoint: testUrl,
            provider,
            modelId,
          }),
        });
      }
    } else {
      testUrl = `${normalizedBaseUrl}/models`;
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
          data: { success: true, models, testedEndpoint: testUrl },
        });
      } else {
        const errText = await response.text();
        log('ERROR', 'OpenAI connection test failed', { status: response.status, body: errText.slice(0, 500) });
        res.json({
          code: 0,
          message: 'success',
          data: buildConnectionErrorResult({
            status: response.status,
            error: `${response.status}: ${errText.slice(0, 200)}`,
            testedEndpoint: testUrl,
            provider,
            modelId,
          }),
        });
      }
    }
  } catch (error) {
    log('ERROR', 'Connection test error', { error: error.message });
    res.json({
      code: 0,
      message: 'success',
      data: buildConnectionErrorResult({
        error: error.message,
        testedEndpoint: provider === 'anthropic' ? `${normalizedBaseUrl}/v1/messages` : `${normalizedBaseUrl}/models`,
        provider,
        modelId,
      }),
    });
  }
});

export default router;
