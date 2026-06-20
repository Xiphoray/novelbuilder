import express from 'express';
import { log } from '../utils/logger.js';
import { getConfigStore } from '../utils/configStore.js';
import { callAI, callAIStream } from '../utils/aiClient.js';
import { parseNovelContent } from '../utils/contentParser.js';
import { toChineseNumber } from '../utils/helpers.js';

const router = express.Router();

// ============ 公共提示词模板 ============
const PROMPTS = {
  generate: {
    system: '你是一位专业的小说作家，擅长创作各类网络小说。请根据用户的要求创作小说，确保内容连贯、情节引人入胜、人物形象鲜明。',
    user: (styleText, userPrompt) => `请根据以下要求创作一部小说：

风格类型：${styleText}
补充描述：${userPrompt || '无'}

要求：
1. 请先输出小说标题（格式：《书名》）
2. 然后创作前2个章节
3. 每个章节约2000字（允许±20%浮动）
4. 章节之间保持剧情连贯
5. 每个章节以"第X章 章节标题"开头（X为中文数字：一、二、三...）
6. 章节之间用两个换行符分隔
7. 输出格式为纯文本`,
  },
  append: {
    system: '你是一位专业的小说作家，正在创作一部连载小说。请根据已有内容和摘要，继续创作后续章节，确保剧情连贯、人物一致、风格统一。',
    user: (bookTitle, style, currentChapterCount, summary, recentContent, nextIndex) => `请继续创作以下小说的后续章节：

书名：${bookTitle || '未命名'}
风格类型：${style || '未指定'}
当前进度：已写到第${currentChapterCount}章

已有内容摘要：
${summary || '暂无摘要'}

最近章节内容：
${recentContent}

要求：
1. 从第${toChineseNumber(nextIndex)}章开始续写，必须严格创作接下来2个章节，不能少于2章，也不能只返回1章
2. 这2个章节必须分别以“第${toChineseNumber(nextIndex)}章 …”和“第${toChineseNumber(nextIndex + 1)}章 …”开头
3. 保持与已有内容在剧情、人物、文风上的一致性
4. 每个章节约2000字
5. 两个章节之间用两个换行符分隔
6. 不要输出说明、备注、分隔符或额外标题，不要重复已有章节内容，直接从新章节开始`,
  },
  summary: {
    system: '你是一位专业的内容分析师。请对小说内容进行结构化摘要，提取关键信息用于后续创作参考。',
    user: (bookTitle, chaptersContent) => `请对以下小说内容进行摘要压缩：

书名：${bookTitle || '未命名'}
章节内容：
${chaptersContent}

要求：
1. 提取主要人物及其关系
2. 总结已发生的关键剧情节点（按时间顺序）
3. 记录世界观/设定要素
4. 记录当前剧情走向和悬念
5. 摘要总长度控制在2000字以内
6. 输出格式为结构化纯文本，使用标题分隔各部分`,
  },
};

// ============ 工具函数 ============
function formatChapters(chapters, startIndex = 1) {
  return chapters.map((ch, i) => ({
    index: startIndex + i,
    title: ch.title,
    content: ch.content,
    wordCount: ch.content.replace(/\s/g, '').length,
  }));
}

function stripLeadingChapterTitle(content, title) {
  const normalizedTitle = (title || '').trim();
  if (!normalizedTitle) return content.trim();

  const normalizedContent = content.replace(/^\uFEFF/, '').trimStart();
  if (!normalizedContent.startsWith(normalizedTitle)) {
    return content.trim();
  }

  return normalizedContent.slice(normalizedTitle.length).trimStart();
}

function normalizeAppendChapters(chapters, nextIndex) {
  return chapters.map((ch, i) => {
    const chapterIndex = nextIndex + i;
    return {
      title: `第${toChineseNumber(chapterIndex)}章`,
      content: stripLeadingChapterTitle(ch.content, ch.title),
    };
  });
}

function splitSingleAppendChapter(chapter, nextIndex) {
  const content = (chapter?.content || '').trim();
  if (!content) return [];

  const secondChapterMarkers = [
    new RegExp(`(^|\\n)第\\s*${toChineseNumber(nextIndex + 1)}\\s*章`, 'm'),
    new RegExp(`(^|\\n)第\\s*${nextIndex + 1}\\s*章`, 'm'),
  ];

  for (const marker of secondChapterMarkers) {
    const match = content.match(marker);
    if (!match || match.index === undefined) continue;

    const splitIndex = match.index + (match[1] ? match[1].length : 0);
    const firstContent = content.slice(0, splitIndex).trim();
    const secondBlock = content.slice(splitIndex).trim();
    const secondTitleMatch = secondBlock.match(/^(第\s*[一二三四五六七八九十百千万零\d]+\s*章[^\n]*)/);
    const secondTitle = secondTitleMatch?.[1]?.replace(/\s+/g, '') || `第${toChineseNumber(nextIndex + 1)}章`;
    const secondContent = stripLeadingChapterTitle(secondBlock, secondTitle);

    if (firstContent && secondContent) {
      return [
        { title: `第${toChineseNumber(nextIndex)}章`, content: firstContent },
        { title: `第${toChineseNumber(nextIndex + 1)}章`, content: secondContent },
      ];
    }
  }

  return [];
}

function ensureTwoAppendChapters(chapters, nextIndex) {
  if (chapters.length >= 2) {
    return normalizeAppendChapters(chapters.slice(0, 2), nextIndex);
  }

  if (chapters.length === 1) {
    const splitChapters = splitSingleAppendChapter(chapters[0], nextIndex);
    if (splitChapters.length === 2) {
      return splitChapters;
    }
  }

  throw new Error('AI 续写结果不足 2 章，请重试');
}

function getSSEHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

function getActiveConfig(configStore, providerId) {
  const activeId = providerId || configStore.activeProviderId;
  return configStore.providers.find(p => p.id === activeId);
}

function normalizeUsage(usage) {
  if (!usage) return undefined;

  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function getGenerationMetadata(config, durationMs) {
  return {
    providerId: config.id,
    provider: config.provider,
    modelId: config.modelId,
    durationMs,
  };
}

// ============ F-005: AI 书籍生成（SSE 流式） ============
router.post('/api/generate/stream', async (req, res) => {
  const { style, userPrompt, providerId } = req.body;
  const configStore = getConfigStore();
  const config = getActiveConfig(configStore, providerId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  if (!style && !userPrompt) {
    return res.json({ code: 40003, message: '请选择风格类型或输入描述', data: null });
  }
  
  const styleText = Array.isArray(style) ? style.join('、') : (style || '');
  const fullPrompt = [styleText, userPrompt].filter(Boolean).join('，');
  
  log('INFO', '=== AI Novel Generation (Stream) Started ===', {
    style: styleText, provider: config.provider, model: config.modelId,
  });
  
  res.writeHead(200, getSSEHeaders());
  
  try {
    const startTime = Date.now();
    const messages = [
      { role: 'system', content: PROMPTS.generate.system },
      { role: 'user', content: PROMPTS.generate.user(styleText, userPrompt) },
    ];

    const stream = await callAIStream(config, messages, {
      maxTokens: config.maxTokens || 16000, temperature: 0.8,
    });

    let fullContent = '', buffer = '';
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
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          let delta = config.provider === 'anthropic'
            ? (parsed.type === 'content_block_delta' ? parsed.delta?.text : '')
            : (parsed.choices?.[0]?.delta?.content || '');
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
          }
        } catch { /* 忽略解析错误 */ }
      }
    }

    const { bookTitle, chapters } = parseNovelContent(fullContent);
    log('INFO', '=== AI Novel Generation (Stream) Completed ===', {
      bookTitle, chapterCount: chapters.length,
    });

    res.write(`data: ${JSON.stringify({
      type: 'done',
      data: {
        title: bookTitle,
        chapters: formatChapters(chapters),
        summary: fullPrompt,
        metadata: getGenerationMetadata(config, Date.now() - startTime),
      },
    })}\n\n`);
    res.end();
  } catch (error) {
    log('ERROR', 'AI stream generation failed', { error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// F-005: 非流式生成
router.post('/api/generate', async (req, res) => {
  const { style, userPrompt, providerId } = req.body;
  const configStore = getConfigStore();
  const config = getActiveConfig(configStore, providerId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  if (!style && !userPrompt) {
    return res.json({ code: 40003, message: '请选择风格类型或输入描述', data: null });
  }
  
  const styleText = Array.isArray(style) ? style.join('、') : (style || '');
  const fullPrompt = [styleText, userPrompt].filter(Boolean).join('，');
  
  log('INFO', '=== AI Novel Generation Started ===', {
    style: styleText, provider: config.provider, model: config.modelId,
  });
  
  try {
    const startTime = Date.now();
    const messages = [
      { role: 'system', content: PROMPTS.generate.system },
      { role: 'user', content: PROMPTS.generate.user(styleText, userPrompt) },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: config.maxTokens || 16000, temperature: 0.8,
    });
    
    const { bookTitle, chapters } = parseNovelContent(content);
    log('INFO', '=== AI Novel Generation Completed ===', { bookTitle, chapterCount: chapters.length });
    
    res.json({
      code: 0, message: 'success',
      data: {
        title: bookTitle,
        chapters: formatChapters(chapters),
        summary: fullPrompt,
        usage: normalizeUsage(usage),
        metadata: getGenerationMetadata(config, Date.now() - startTime),
      },
    });
  } catch (error) {
    log('ERROR', 'AI generation failed', { error: error.message });
    res.json({ code: 50001, message: `AI 生成失败: ${error.message}`, data: null });
  }
});

// ============ F-006: 追加生成（SSE 流式） ============
router.post('/api/generate/append/stream', async (req, res) => {
  const { bookId, bookTitle, style, summary, recentChapters, currentChapterCount } = req.body;
  const configStore = getConfigStore();
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Append Generation (Stream) Started ===', {
    bookId, currentChapterCount, provider: config.provider,
  });
  
  res.writeHead(200, getSSEHeaders());
  
  try {
    const startTime = Date.now();
    const nextIndex = currentChapterCount + 1;
    const recentContent = (recentChapters || []).map(ch => `${ch.title}\n${ch.content}`).join('\n\n');
    
    const messages = [
      { role: 'system', content: PROMPTS.append.system },
      { role: 'user', content: PROMPTS.append.user(bookTitle, style, currentChapterCount, summary, recentContent, nextIndex) },
    ];

    const stream = await callAIStream(config, messages, {
      maxTokens: Math.min(config.maxTokens || 16000, 16000), temperature: 0.8,
    });

    let fullContent = '', buffer = '';
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
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          let delta = config.provider === 'anthropic'
            ? (parsed.type === 'content_block_delta' ? parsed.delta?.text : '')
            : (parsed.choices?.[0]?.delta?.content || '');
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
          }
        } catch { /* 忽略 */ }
      }
    }

    const { chapters } = parseNovelContent(fullContent);
    const normalizedChapters = ensureTwoAppendChapters(chapters, nextIndex);
    log('INFO', '=== AI Append Generation (Stream) Completed ===', {
      bookId,
      newChapterCount: normalizedChapters.length,
      chapterTitles: normalizedChapters.map(ch => ch.title),
    });

    res.write(`data: ${JSON.stringify({
      type: 'done',
      data: {
        chapters: formatChapters(normalizedChapters, nextIndex),
        metadata: getGenerationMetadata(config, Date.now() - startTime),
      },
    })}\n\n`);
    res.end();
  } catch (error) {
    log('ERROR', 'AI stream append failed', { error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// F-006: 非流式追加生成
router.post('/api/generate/append', async (req, res) => {
  const { bookId, bookTitle, style, summary, recentChapters, currentChapterCount } = req.body;
  const configStore = getConfigStore();
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Append Generation Started ===', { bookId, currentChapterCount });
  
  try {
    const startTime = Date.now();
    const nextIndex = currentChapterCount + 1;
    const recentContent = (recentChapters || []).map(ch => `${ch.title}\n${ch.content}`).join('\n\n');
    
    const messages = [
      { role: 'system', content: PROMPTS.append.system },
      { role: 'user', content: PROMPTS.append.user(bookTitle, style, currentChapterCount, summary, recentContent, nextIndex) },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: Math.min(config.maxTokens || 16000, 16000), temperature: 0.8,
    });
    
    const { chapters } = parseNovelContent(content);
    const normalizedChapters = ensureTwoAppendChapters(chapters, nextIndex);
    log('INFO', '=== AI Append Generation Completed ===', {
      bookId,
      newChapterCount: normalizedChapters.length,
      chapterTitles: normalizedChapters.map(ch => ch.title),
    });
    
    res.json({
      code: 0, message: 'success',
      data: {
        chapters: formatChapters(normalizedChapters, nextIndex),
        usage: normalizeUsage(usage),
        metadata: getGenerationMetadata(config, Date.now() - startTime),
      },
    });
  } catch (error) {
    log('ERROR', 'AI append failed', { error: error.message });
    res.json({ code: 50001, message: `追加生成失败: ${error.message}`, data: null });
  }
});

// ============ 摘要生成 ============
router.post('/api/generate/summary', async (req, res) => {
  const { bookTitle, chapters } = req.body;
  const configStore = getConfigStore();
  const config = configStore.providers.find(p => p.id === configStore.activeProviderId);
  
  if (!config) {
    return res.json({ code: 40001, message: '请先配置 AI Provider', data: null });
  }
  
  log('INFO', '=== AI Summary Generation Started ===', { bookTitle, chapterCount: chapters?.length });
  
  try {
    const startTime = Date.now();
    const chaptersContent = (chapters || []).map(ch => `${ch.title}\n${ch.content}`).join('\n\n');
    
    const messages = [
      { role: 'system', content: PROMPTS.summary.system },
      { role: 'user', content: PROMPTS.summary.user(bookTitle, chaptersContent) },
    ];
    
    const { content, usage } = await callAI(config, messages, {
      maxTokens: 4000, temperature: 0.3,
    });
    
    log('INFO', '=== AI Summary Generation Completed ===', { summaryLength: content.length });
    res.json({
      code: 0,
      message: 'success',
      data: {
        summary: content,
        usage: normalizeUsage(usage),
        metadata: getGenerationMetadata(config, Date.now() - startTime),
      },
    });
  } catch (error) {
    log('ERROR', 'AI summary failed', { error: error.message });
    res.json({ code: 50001, message: `摘要生成失败: ${error.message}`, data: null });
  }
});

export default router;