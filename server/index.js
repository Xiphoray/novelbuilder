import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5298;

// ============ 日志系统 ============
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFileName() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `api-${dateStr}.log`);
}

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // 写入文件
  fs.appendFileSync(getLogFileName(), logLine);
  
  // 同时输出到控制台
  const consoleMsg = `[${timestamp}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(consoleMsg, data ? JSON.stringify(data).slice(0, 500) : '');
  } else {
    console.log(consoleMsg, data ? JSON.stringify(data).slice(0, 200) : '');
  }
}

// ============ 中间件 ============
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  log('INFO', `→ ${req.method} ${req.url}`, {
    query: req.query,
    bodyKeys: Object.keys(req.body || {}),
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('INFO', `← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// ============ 配置存储（内存 + 文件持久化） ============
const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    log('ERROR', 'Failed to load config', { error: e.message });
  }
  return { providers: [], activeProviderId: null };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let configStore = loadConfig();

// ============ AI Provider 适配层 ============

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
async function fetchModelInfo(config) {
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
 * maxOutputTokens: 模型返回的最大输出 token（如果有）
 * contextLength: 模型的上下文窗口长度
 * 生成端点需要足够的输出空间来生成完整章节
 */
function calcMaxOutputTokens(modelInfo, defaultVal = 16000) {
  if (modelInfo?.maxOutputTokens) {
    // 模型明确指定了最大输出 token
    return Math.min(modelInfo.maxOutputTokens, 32000);
  }
  if (modelInfo?.contextLength) {
    // 根据上下文长度推算合理的输出上限
    // 一般模型输出不超过上下文的 25%，且上限 32K
    return Math.min(Math.floor(modelInfo.contextLength * 0.25), 32000);
  }
  return defaultVal;
}

/**
 * 调用 AI API（支持 OpenAI / Anthropic / OpenAI Compatible）
 */
async function callAI(config, messages, options = {}) {
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
 * 返回 ReadableStream，逐 token 输出内容
 */
async function callAIStream(config, messages, options = {}) {
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

// ============ 内容解析工具 ============

const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

/**
 * 解析 AI 生成的小说内容
 */
function parseNovelContent(content) {
  log('INFO', 'Parsing novel content', { contentLength: content.length });
  
  const lines = content.split(/\r?\n/);
  let bookTitle = 'AI生成小说';
  
  // 尝试从第一行提取书名
  const firstLine = lines[0]?.trim() || '';
  const titleMatch = firstLine.match(/《(.+?)》/) || firstLine.match(/^[：:]*\s*(.+?)\s*$/);
  if (titleMatch?.[1] && titleMatch[1].length < 50) {
    bookTitle = titleMatch[1].trim();
  }
  
  // 解析章节
  const chapterPattern = /^第[一二三四五六七八九十百千万零\d]+[章节回集部篇]/;
  const chapters = [];
  let currentTitle = '第一章';
  let currentContent = '';
  let startParsing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();
    
    if (chapterPattern.test(trimmed)) {
      if (startParsing && currentContent.trim()) {
        chapters.push({ title: currentTitle, content: currentContent.trim() });
      }
      currentTitle = trimmed;
      currentContent = '';
      startParsing = true;
    } else if (startParsing) {
      currentContent += line + '\n';
    } else if (trimmed === '' && !startParsing) {
      // 跳过标题后的空行
      continue;
    }
  }
  
  // 最后一章
  if (currentContent.trim()) {
    chapters.push({ title: currentTitle, content: currentContent.trim() });
  }
  
  // 如果没有识别到章节，把全部内容作为一章
  if (chapters.length === 0) {
    // 跳过第一行（可能是标题）
    const bodyContent = lines.slice(1).join('\n').trim() || content;
    chapters.push({ title: '第一章', content: bodyContent });
  }
  
  log('INFO', 'Parsed novel result', {
    bookTitle,
    chapterCount: chapters.length,
    chapterTitles: chapters.map(c => c.title),
    wordCounts: chapters.map(c => c.content.replace(/\s/g, '').length),
  });
  
  return { bookTitle, chapters };
}

// ============ API 路由 ============

// 获取配置
app.get('/api/config', (req, res) => {
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
app.post('/api/config', async (req, res) => {
  const { provider, baseUrl, apiKey, modelId, name, id } = req.body;
  
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
    apiKey, // 服务端加密存储（简化为明文，生产环境应加密）
    modelId,
    maxTokens: maxOutputTokens, // 自动计算的最大输出 token 数
    contextLength: modelInfo?.contextLength || null, // 模型上下文窗口长度（参考信息）
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
app.post('/api/config/activate', (req, res) => {
  const { id } = req.body;
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
app.delete('/api/config/:id', (req, res) => {
  const { id } = req.params;
  configStore.providers = configStore.providers.filter(p => p.id !== id);
  
  if (configStore.activeProviderId === id) {
    configStore.activeProviderId = configStore.providers[0]?.id || null;
  }
  
  saveConfig(configStore);
  log('INFO', `Config deleted: ${id}`);
  
  res.json({ code: 0, message: 'success', data: null });
});

// 测试连接
app.post('/api/test-connection', async (req, res) => {
  const { provider, baseUrl, apiKey, modelId } = req.body;
  
  if (!provider || !baseUrl || !apiKey) {
    return res.json({ code: 40003, message: '请填写完整配置', data: null });
  }
  
  log('INFO', `Testing connection: ${provider}`, { baseUrl, modelId });
  
  try {
    let testUrl, headers;
    
    if (provider === 'anthropic') {
      // Anthropic 没有 models 列表端点，直接测试 messages API
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
      // OpenAI / OpenAI Compatible - 尝试获取模型列表
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

// ============ F-005: AI 书籍生成（SSE 流式） ============
app.post('/api/generate/stream', async (req, res) => {
  const { style, userPrompt, providerId } = req.body;
  
  const activeId = providerId || configStore.activeProviderId;
  const config = configStore.providers.find(p => p.id === activeId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  if (!style && !userPrompt) {
    return res.json({ code: 40003, message: '请选择风格类型或输入描述', data: null });
  }
  
  const styleText = Array.isArray(style) ? style.join('、') : (style || '');
  const fullPrompt = [styleText, userPrompt].filter(Boolean).join('，');
  
  log('INFO', '=== AI Novel Generation (Stream) Started ===', {
    style: styleText, userPrompt, provider: config.provider, model: config.modelId,
  });
  
  // 设置 SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  
  try {
    const systemPrompt = `你是一位专业的小说作家，擅长创作各类网络小说。请根据用户的要求创作小说，确保内容连贯、情节引人入胜、人物形象鲜明。`;
    const userMessage = `请根据以下要求创作一部小说：

风格类型：${styleText}
补充描述：${userPrompt || '无'}

要求：
1. 请先输出小说标题（格式：《书名》）
2. 然后创作前5个章节
3. 每个章节约2000字（允许±20%浮动）
4. 章节之间保持剧情连贯
5. 每个章节以"第X章 章节标题"开头（X为中文数字：一、二、三...）
6. 章节之间用两个换行符分隔
7. 输出格式为纯文本`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    
    const stream = await callAIStream(config, messages, {
      maxTokens: config.maxTokens || 16000,
      temperature: 0.8,
    });
    
    let fullContent = '';
    let buffer = '';
    
    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start', prompt: fullPrompt })}\n\n`);
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          let delta = '';
          
          if (config.provider === 'anthropic') {
            if (parsed.type === 'content_block_delta') {
              delta = parsed.delta?.text || '';
            }
          } else {
            delta = parsed.choices?.[0]?.delta?.content || '';
          }
          
          if (delta) {
            fullContent += delta;
            // 发送每个 token
            res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    // 解析最终内容
    const { bookTitle, chapters } = parseNovelContent(fullContent);
    
    log('INFO', '=== AI Novel Generation (Stream) Completed ===', {
      bookTitle, chapterCount: chapters.length, contentLength: fullContent.length,
    });
    
    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      type: 'done',
      data: {
        title: bookTitle,
        chapters: chapters.map((ch, i) => ({
          index: i + 1,
          title: ch.title,
          content: ch.content,
          wordCount: ch.content.replace(/\s/g, '').length,
        })),
        summary: fullPrompt,
      },
    })}\n\n`);
    
    res.end();
  } catch (error) {
    log('ERROR', 'AI stream generation failed', { error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// F-005: 非流式生成（保留兼容）
app.post('/api/generate', async (req, res) => {
  const { style, userPrompt, providerId } = req.body;
  
  // 获取活跃配置
  const activeId = providerId || configStore.activeProviderId;
  const config = configStore.providers.find(p => p.id === activeId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  if (!style && !userPrompt) {
    return res.json({ code: 40003, message: '请选择风格类型或输入描述', data: null });
  }
  
  const styleText = Array.isArray(style) ? style.join('、') : (style || '');
  const fullPrompt = [styleText, userPrompt].filter(Boolean).join('，');
  
  log('INFO', '=== AI Novel Generation Started ===', {
    style: styleText,
    userPrompt,
    provider: config.provider,
    model: config.modelId,
  });
  
  try {
    const systemPrompt = `你是一位专业的小说作家，擅长创作各类网络小说。请根据用户的要求创作小说，确保内容连贯、情节引人入胜、人物形象鲜明。`;

    const userMessage = `请根据以下要求创作一部小说：

风格类型：${styleText}
补充描述：${userPrompt || '无'}

要求：
1. 请先输出小说标题（格式：《书名》）
2. 然后创作前5个章节
3. 每个章节约2000字（允许±20%浮动）
4. 章节之间保持剧情连贯
5. 每个章节以"第X章 章节标题"开头（X为中文数字：一、二、三...）
6. 章节之间用两个换行符分隔
7. 输出格式为纯文本`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: config.maxTokens || 16000,
      temperature: 0.8,
    });
    
    const { bookTitle, chapters } = parseNovelContent(content);
    
    log('INFO', '=== AI Novel Generation Completed ===', {
      bookTitle,
      chapterCount: chapters.length,
      usage,
    });
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        title: bookTitle,
        chapters: chapters.map((ch, i) => ({
          index: i + 1,
          title: ch.title,
          content: ch.content,
          wordCount: ch.content.replace(/\s/g, '').length,
        })),
        summary: fullPrompt,
        usage,
      },
    });
  } catch (error) {
    log('ERROR', 'AI generation failed', { error: error.message });
    res.json({
      code: 50001,
      message: `AI 生成失败: ${error.message}`,
      data: null,
    });
  }
});

// ============ F-006: 追加生成（SSE 流式） ============
app.post('/api/generate/append/stream', async (req, res) => {
  const { bookId, bookTitle, style, summary, recentChapters, currentChapterCount } = req.body;
  
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Append Generation (Stream) Started ===', {
    bookId, bookTitle, currentChapterCount,
    recentChapterCount: recentChapters?.length || 0,
    provider: config.provider, model: config.modelId,
  });
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  
  try {
    const nextIndex = currentChapterCount + 1;
    const recentContent = (recentChapters || [])
      .map(ch => `${ch.title}\n${ch.content}`)
      .join('\n\n');
    
    const systemPrompt = `你是一位专业的小说作家，正在创作一部连载小说。请根据已有内容和摘要，继续创作后续章节，确保剧情连贯、人物一致、风格统一。`;

    const userMessage = `请继续创作以下小说的后续章节：

书名：${bookTitle || '未命名'}
风格类型：${style || '未指定'}
当前进度：已写到第${currentChapterCount}章

已有内容摘要：
${summary || '暂无摘要'}

最近章节内容：
${recentContent}

要求：
1. 从第${toChineseNumber(nextIndex)}章开始续写，创作接下来3个章节
2. 保持与已有内容在剧情、人物、文风上的一致性
3. 每个章节约2000字
4. 每个章节以"第X章 章节标题"开头（X为中文数字，续接已有编号）
5. 章节之间用两个换行符分隔
6. 不要重复已有章节内容，直接从新章节开始`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    
    const stream = await callAIStream(config, messages, {
      maxTokens: Math.min(config.maxTokens || 16000, 16000),
      temperature: 0.8,
    });
    
    let fullContent = '';
    let buffer = '';
    
    res.write(`data: ${JSON.stringify({ type: 'start', prompt: '' })}\n\n`);
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          let delta = '';
          
          if (config.provider === 'anthropic') {
            if (parsed.type === 'content_block_delta') {
              delta = parsed.delta?.text || '';
            }
          } else {
            delta = parsed.choices?.[0]?.delta?.content || '';
          }
          
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
          }
        } catch {
          // 忽略
        }
      }
    }
    
    const { chapters } = parseNovelContent(fullContent);
    
    log('INFO', '=== AI Append Generation (Stream) Completed ===', {
      bookId, newChapterCount: chapters.length, nextIndex,
    });
    
    res.write(`data: ${JSON.stringify({
      type: 'done',
      data: {
        chapters: chapters.map((ch, i) => ({
          index: nextIndex + i,
          title: ch.title,
          content: ch.content,
          wordCount: ch.content.replace(/\s/g, '').length,
        })),
      },
    })}\n\n`);
    
    res.end();
  } catch (error) {
    log('ERROR', 'AI stream append generation failed', { error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// F-006: 非流式追加生成（保留兼容）
app.post('/api/generate/append', async (req, res) => {
  const { bookId, bookTitle, style, summary, recentChapters, currentChapterCount } = req.body;
  
  // 获取活跃配置
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Append Generation Started ===', {
    bookId,
    bookTitle,
    currentChapterCount,
    recentChapterCount: recentChapters?.length || 0,
    summaryLength: summary?.length || 0,
    provider: config.provider,
    model: config.modelId,
  });
  
  try {
    const nextIndex = currentChapterCount + 1;
    
    // 构建最近章节内容
    const recentContent = (recentChapters || [])
      .map(ch => `${ch.title}\n${ch.content}`)
      .join('\n\n');
    
    const systemPrompt = `你是一位专业的小说作家，正在创作一部连载小说。请根据已有内容和摘要，继续创作后续章节，确保剧情连贯、人物一致、风格统一。`;

    const userMessage = `请继续创作以下小说的后续章节：

书名：${bookTitle || '未命名'}
风格类型：${style || '未指定'}
当前进度：已写到第${currentChapterCount}章

已有内容摘要：
${summary || '暂无摘要'}

最近章节内容：
${recentContent}

要求：
1. 从第${toChineseNumber(nextIndex)}章开始续写，创作接下来3个章节
2. 保持与已有内容在剧情、人物、文风上的一致性
3. 每个章节约2000字
4. 每个章节以"第X章 章节标题"开头（X为中文数字，续接已有编号）
5. 章节之间用两个换行符分隔
6. 不要重复已有章节内容，直接从新章节开始`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: Math.min(config.maxTokens || 16000, 16000),
      temperature: 0.8,
    });
    
    const { chapters } = parseNovelContent(content);
    
    log('INFO', '=== AI Append Generation Completed ===', {
      bookId,
      newChapterCount: chapters.length,
      nextIndex,
      usage,
    });
    
    res.json({
      code: 0,
      message: 'success',
      data: {
        chapters: chapters.map((ch, i) => ({
          index: nextIndex + i,
          title: ch.title,
          content: ch.content,
          wordCount: ch.content.replace(/\s/g, '').length,
        })),
        usage,
      },
    });
  } catch (error) {
    log('ERROR', 'AI append generation failed', { error: error.message });
    res.json({
      code: 50001,
      message: `追加生成失败: ${error.message}`,
      data: null,
    });
  }
});

// ============ 摘要生成 ============
app.post('/api/generate/summary', async (req, res) => {
  const { bookTitle, chapters } = req.body;
  
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Summary Generation Started ===', {
    bookTitle,
    chapterCount: chapters?.length || 0,
  });
  
  try {
    const chaptersContent = (chapters || [])
      .map(ch => `${ch.title}\n${ch.content}`)
      .join('\n\n');
    
    const systemPrompt = `你是一位专业的内容分析师。请对小说内容进行结构化摘要，提取关键信息用于后续创作参考。`;

    const userMessage = `请对以下小说内容进行摘要压缩：

书名：${bookTitle || '未命名'}
章节内容：
${chaptersContent}

要求：
1. 提取主要人物及其关系
2. 总结已发生的关键剧情节点（按时间顺序）
3. 记录世界观/设定要素
4. 记录当前剧情走向和悬念
5. 摘要总长度控制在2000字以内
6. 输出格式为结构化纯文本，使用标题分隔各部分`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: 4000,
      temperature: 0.3,
    });
    
    log('INFO', '=== AI Summary Generation Completed ===', {
      summaryLength: content.length,
      usage,
    });
    
    res.json({
      code: 0,
      message: 'success',
      data: { summary: content, usage },
    });
  } catch (error) {
    log('ERROR', 'AI summary generation failed', { error: error.message });
    res.json({
      code: 50001,
      message: `摘要生成失败: ${error.message}`,
      data: null,
    });
  }
});

// ============ 工具函数 ============
function toChineseNumber(num) {
  const units = ['', '十', '百', '千'];
  const nums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  
  if (num <= 10) {
    return nums[num] || String(num);
  }
  if (num < 20) {
    return '十' + (num % 10 === 0 ? '' : nums[num % 10]);
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return nums[tens] + '十' + (ones === 0 ? '' : nums[ones]);
  }
  return String(num); // 超过99直接用阿拉伯数字
}

// ============ 启动服务 ============
app.listen(PORT, () => {
  log('INFO', `🚀 NovelBuilder API Server started on http://localhost:${PORT}`);
  log('INFO', `📝 Logs directory: ${LOG_DIR}`);
  log('INFO', `📦 Config file: ${CONFIG_FILE}`);
  
  console.log(`\n========================================`);
  console.log(`  NovelBuilder API Server`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Logs: ${LOG_DIR}`);
  console.log(`========================================\n`);
});
