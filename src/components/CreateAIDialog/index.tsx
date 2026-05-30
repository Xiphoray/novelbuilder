import { useState } from 'react';
import { Modal, Input, Tag, Space, Typography, message, Spin } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Book, Chapter } from '@/types';
import { HOT_STYLE_TAGS } from '@/types';

const { TextArea } = Input;
const { Text } = Typography;

interface CreateAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateAIDialog({ open, onClose }: CreateAIDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const addBook = useBookStore((s) => s.addBook);
  const openBook = useBookStore((s) => s.openBook);
  const activeAIConfig = useSettingsStore((s) => s.activeAIConfig);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleGenerate = async () => {
    if (!activeAIConfig) {
      message.error('请先在设置中配置 AI Provider');
      return;
    }

    const styleText = selectedTags.join('、');
    const fullPrompt = [styleText, customPrompt].filter(Boolean).join('，');

    if (!fullPrompt.trim()) {
      message.error('请选择风格类型或输入描述');
      return;
    }

    setGenerating(true);

    try {
      // Call AI API to generate initial 5 chapters
      const { baseUrl, modelId, provider } = activeAIConfig;
      const apiKey = localStorage.getItem('novelbuilder_ai_api_key') || '';

      const systemPrompt = `你是一位专业的小说作家。请根据用户的要求创作一部小说。
要求：
1. 请创作小说的标题和前5个章节
2. 每个章节约2000字
3. 章节之间保持剧情连贯
4. 每个章节以"第X章 章节标题"开头，用空行分隔章节
5. 输出格式为纯文本
6. 第一行输出书名，格式为：《书名》`;

      const userPrompt = `请创作一部小说，风格类型：${fullPrompt}`;

      let apiUrl = '';
      let headers: Record<string, string> = {};
      let body: Record<string, unknown> = {};

      if (provider === 'anthropic') {
        apiUrl = `${baseUrl}/v1/messages`;
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        body = {
          model: modelId,
          max_tokens: 16000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        };
      } else {
        // OpenAI and OpenAI-compatible
        apiUrl = `${baseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        };
        body = {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 16000,
          temperature: 0.8,
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let content = '';

      if (provider === 'anthropic') {
        content = data.content?.[0]?.text || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }

      if (!content) {
        throw new Error('AI 返回内容为空');
      }

      // Parse the generated content
      const lines = content.split(/\r?\n/);
      let bookTitle = 'AI生成小说';

      // Try to extract book title from first line
      const titleMatch = lines[0]?.match(/《(.+?)》/) || lines[0]?.match(/^[:：]*(.+)/);
      if (titleMatch?.[1]) {
        bookTitle = titleMatch[1].trim();
      }

      // Parse chapters
      const chapterPattern = /^第[一二三四五六七八九十百千万零\d]+[章节回集部篇]/;
      const chapters: { title: string; content: string }[] = [];
      let currentTitle = '第一章';
      let currentContent = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i] || '';
        if (chapterPattern.test(line) && currentContent.trim()) {
          chapters.push({ title: currentTitle, content: currentContent.trim() });
          currentTitle = line.trim();
          currentContent = '';
        } else {
          currentContent += line + '\n';
        }
      }
      if (currentContent.trim()) {
        chapters.push({ title: currentTitle, content: currentContent.trim() });
      }

      // Ensure at least 1 chapter
      if (chapters.length === 0) {
        chapters.push({ title: '第一章', content: content });
      }

      const bookId = uuidv4();
      const now = Date.now();
      const chapterEntities: Chapter[] = chapters.map((ch, i) => ({
        id: uuidv4(),
        bookId,
        index: i + 1,
        title: ch.title,
        content: ch.content,
        wordCount: ch.content.replace(/\s/g, '').length,
        status: 'complete' as const,
        createdAt: now,
      }));

      const book: Book = {
        id: bookId,
        title: bookTitle,
        type: 'ai',
        chapterCount: chapters.length,
        totalWordCount: chapterEntities.reduce((s, c) => s + c.wordCount, 0),
        summary: fullPrompt,
        readingProgress: { chapterIndex: 0, scrollOffset: 0 },
        createdAt: now,
        updatedAt: now,
        aiConfig: {
          providerId: activeAIConfig.id,
          modelId: activeAIConfig.modelId,
          style: styleText,
          userPrompt: customPrompt,
        },
      };

      await addBook(book, chapterEntities);
      await openBook(bookId);

      message.success(`《${bookTitle}》生成完毕，共 ${chapters.length} 章`);
      resetForm();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '生成失败，请重试';
      message.error(errorMsg);
      console.error('AI generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setSelectedTags([]);
    setCustomPrompt('');
  };

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          创建 AI 书籍
        </Space>
      }
      open={open}
      onCancel={() => {
        if (!generating) {
          resetForm();
          onClose();
        }
      }}
      onOk={handleGenerate}
      okText={generating ? '生成中...' : '开始生成'}
      cancelText="取消"
      confirmLoading={generating}
      closable={!generating}
      maskClosable={!generating}
      width={560}
    >
      <Spin spinning={generating} tip="AI 正在创作中，请稍候...">
        <div style={{ minHeight: 200 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>选择风格类型：</Text>
            <div style={{ marginTop: 8 }}>
              {HOT_STYLE_TAGS.map((tag) => (
                <Tag.CheckableTag
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  style={{
                    fontSize: 14,
                    padding: '4px 12px',
                    marginBottom: 8,
                  }}
                >
                  {tag}
                </Tag.CheckableTag>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>补充描述（选填）：</Text>
            <TextArea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="如：末日废土风格，主角是女性，有一个神秘的系统..."
              rows={4}
              style={{ marginTop: 8 }}
              disabled={generating}
            />
          </div>

          {!activeAIConfig && (
            <Text type="danger" style={{ fontSize: 12 }}>
              ⚠️ 未检测到 AI 配置，请先在设置中添加并启用一个 AI Provider
            </Text>
          )}
        </div>
      </Spin>
    </Modal>
  );
}
