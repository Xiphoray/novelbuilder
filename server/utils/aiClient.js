import { log } from './logger.js';
import { withApiKey } from './configStore.js';

/**
 * 构建 OpenAI 格式请求
 */
function buildOpenAIRequest(config, messages, options = {}) {
  const { baseUrl, apiKey, modelId } = config;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  const body = {
    model: modelId,
    messages,
    max_tokens: options.maxTokens || 16000,
    temperature: options.temperature || 0.8,
    ...options.extra,
  };
  return { url, headers, body };
}

/**
 * 构建 Anthropic 格式请求
 */
function buildAnthropicRequest(config, messages, options = {}) {
  const { baseUrl, apiKey, modelId } = config;
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  
  // 提取 system prompt
  const systemMsg = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');
  
  const body = {
    model: modelId,
    max_tokens: options.maxTokens || 16000,
    messages: userMessages,
    ...(systemMsg && { system: systemMsg.content }),
    ...(options.temperature && { temperature: options.temperature }),
  };
  return { url, headers, body };
}

/**
 * 查询模型信息（获取 max_tokens / context_length）
 */
export async function fetchModelInfo(config) {
  try {
    const { baseUrl, apiKey, modelId, provider } = config;

    if (provider === 'anthropic') {
      // Anthropic 没有 models 端点，使用已知默认值
      return { contextLength: 200000, maxOutputTokens: 8192 };
    }

    // 从模型对象中提取上下文长度和最大输出 token
    function extractFromModel(model) {
      const contextLength =
        model.max_model_len ||
        model.context_length ||
        model.max_context_length ||
        model.model_max_length ||
        model?.limits?.max_context_length ||
        null;

      const maxOutputTokens =
        model.max_output_tokens ||
        model?.limits?.max_output_tokens ||
        model?.limits?.max_tokens ||
        null;

      return { contextLength, maxOutputTokens };
    }

    // 尝试从 /models 列表获取（兼容性最好）
    const listUrl = `${baseUrl.replace(/\/+$/, '')}/models`;
    const headers = { 'Authorization': `Bearer ${apiKey}` };
    const listRes = await fetch(listUrl, { method: 'GET', headers });
    if (listRes.ok) {
      const listData = await listRes.json();
      const model = (listData.data || []).find(m => m.id === modelId);
      if (model) {
        const info = extractFromModel(model);
        if (info.contextLength || info.maxOutputTokens) {
          log('INFO', `Model info from list: ${modelId}`, info);
          return info;
        }
      }
    }

    // 尝试从单个模型端点获取
    const url = `${baseUrl.replace(/\/+$/, '')}/models/${modelId}`;
    const response = await fetch(url, { method: 'GET', headers });
    if (response.ok) {
      const data = await response.json();
      const info = extractFromModel(data);
      if (info.contextLength || info.maxOutputTokens) {
        log('INFO', `Model info fetched: ${modelId}`, info);
        return info;
      }
    }

    log('INFO', `Could not determine model info for ${modelId}, using defaults`);
    return null;
  } catch (e) {
    log('WARN', `Failed to fetch model info: ${e.message}`);
    return null;
  }
}

/**
 * 计算合理的最大输出 token 数
 */
export function calcMaxOutputTokens(modelInfo, defaultVal = 16000) {
  if (modelInfo?.maxOutputTokens) {
    return Math.min(modelInfo.maxOutputTokens, 32000);
  }
  if (modelInfo?.contextLength) {
    return Math.min(Math.floor(modelInfo.contextLength * 0.25), 32000);
  }
  return defaultVal;
}

/**
 * 调用 AI API（支持 OpenAI / Anthropic / OpenAI Compatible）
 */
export async function callAI(config, messages, options = {}) {
  // 补全 apiKey：调用方传了明文则直接用，否则按 id 从加密层解密
  config = withApiKey(config);
  let request;
  
  if (config.provider === 'anthropic') {
    request = buildAnthropicRequest(config, messages, options);
  } else {
    // OpenAI 和 OpenAI Compatible
    request = buildOpenAIRequest(config, messages, options);
  }
  
  log('INFO', `Calling AI API: ${config.provider}`, {
    url: request.url,
    model: config.modelId,
    messageCount: messages.length,
    maxTokens: request.body.max_tokens,
  });
  
  const startTime = Date.now();
  
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  
  const duration = Date.now() - startTime;
  
  if (!response.ok) {
    const errorText = await response.text();
    log('ERROR', `AI API error: ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 1000),
    });
    throw new Error(`AI API 请求失败: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
  }
  
  const data = await response.json();
  
  // 提取内容
  let content = '';
  let usage = null;
  
  if (config.provider === 'anthropic') {
    content = data.content?.[0]?.text || '';
    usage = data.usage;
  } else {
    content = data.choices?.[0]?.message?.content || '';
    usage = data.usage;
  }
  
  log('INFO', `AI API response received (${duration}ms)`, {
    contentLength: content.length,
    usage,
  });
  
  return { content, usage };
}

/**
 * 调用 AI API - 流式模式（SSE）
 */
export async function callAIStream(config, messages, options = {}, { signal } = {}) {
  // 补全 apiKey：调用方传了明文则直接用，否则按 id 从加密层解密
  config = withApiKey(config);
  let request;
  
  if (config.provider === 'anthropic') {
    request = buildAnthropicRequest(config, messages, { ...options, extra: { stream: true } });
  } else {
    request = buildOpenAIRequest(config, messages, { ...options, extra: { stream: true } });
  }
  
  log('INFO', `Calling AI API (stream): ${config.provider}`, {
    url: request.url,
    model: config.modelId,
    messageCount: messages.length,
    maxTokens: request.body.max_tokens,
  });
  
  const startTime = Date.now();
  
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    log('ERROR', `AI API stream error: ${response.status}`, {
      status: response.status,
      body: errorText.slice(0, 1000),
    });
    throw new Error(`AI API 请求失败: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`);
  }
  
  log('INFO', `AI API stream started (${Date.now() - startTime}ms)`);
  return response.body;
}
