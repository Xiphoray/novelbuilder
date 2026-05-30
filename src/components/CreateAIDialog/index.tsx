import { useState } from 'react';
import { Modal, Input, Tag, Space, Typography, Spin, App } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Book, Chapter } from '@/types';
import { HOT_STYLE_TAGS } from '@/types';
import { generateNovel } from '@/services/aiService';

const { TextArea } = Input;
const { Text } = Typography;

interface CreateAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateAIDialog({ open, onClose }: CreateAIDialogProps) {
  const { message } = App.useApp();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
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
    setProgress('正在调用 AI 生成小说...');

    try {
      console.log('[CreateAI] 开始生成小说', { style: styleText, userPrompt: customPrompt });

      // 通过后端 API 调用 AI 生成
      const result = await generateNovel({
        style: selectedTags,
        userPrompt: customPrompt || undefined,
      });

      console.log('[CreateAI] AI 生成完成', {
        title: result.title,
        chapterCount: result.chapters.length,
      });

      setProgress('正在保存到本地数据库...');

      const bookId = uuidv4();
      const now = Date.now();
      const chapterEntities: Chapter[] = result.chapters.map((ch) => ({
        id: uuidv4(),
        bookId,
        index: ch.index,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
        status: 'complete' as const,
        createdAt: now,
      }));

      const book: Book = {
        id: bookId,
        title: result.title,
        type: 'ai',
        chapterCount: result.chapters.length,
        totalWordCount: chapterEntities.reduce((s, c) => s + c.wordCount, 0),
        summary: result.summary || fullPrompt,
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

      console.log('[CreateAI] 书籍已保存并打开', { bookId, title: result.title });
      message.success(`《${result.title}》生成完毕，共 ${result.chapters.length} 章`);
      resetForm();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '生成失败，请重试';
      console.error('[CreateAI] 生成失败:', err);
      message.error(errorMsg);
    } finally {
      setGenerating(false);
      setProgress('');
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
      <Spin spinning={generating} tip={progress || 'AI 正在创作中，请稍候...'}>
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
