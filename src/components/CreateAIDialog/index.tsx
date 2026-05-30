import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Tag, Space, Typography, Spin, App, Progress } from 'antd';
import { RobotOutlined, ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Book, Chapter } from '@/types';
import { HOT_STYLE_TAGS } from '@/types';
import { generateNovelStream, generateNovel } from '@/services/aiService';

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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [streamContent, setStreamContent] = useState('');
  const [useStream] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  // 计时器
  useEffect(() => {
    if (generating) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          elapsedRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generating]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };
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
    setProgress('正在连接 AI 服务...');
    setStreamContent('');

    try {
      console.log('[CreateAI] 开始生成小说', { style: styleText, userPrompt: customPrompt });

      let result;

      if (useStream) {
        // 流式生成：实时显示内容
        setProgress('AI 正在创作中，内容将实时展示...');
        result = await generateNovelStream({
          style: selectedTags,
          userPrompt: customPrompt || undefined,
        }, {
          onStart: (prompt) => {
            setProgress('AI 已收到请求，开始创作...');
            console.log('[CreateAI] 流式开始', { promptLength: prompt.length });
          },
          onDelta: (_content, accumulated) => {
            setStreamContent(accumulated);
          },
          onDone: (data) => {
            result = data;
          },
          onError: (msg) => {
            throw new Error(msg);
          },
        });
      } else {
        // 非流式生成
        setProgress('正在调用 AI 生成小说，请耐心等待...');
        result = await generateNovel({
          style: selectedTags,
          userPrompt: customPrompt || undefined,
        });
      }

      if (!result) throw new Error('生成失败：未收到结果');

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
      message.success(`《${result.title}》生成完毕，耗时 ${formatTime(elapsedRef.current)}，共 ${result.chapters.length} 章`);
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
    <Spin spinning={generating} tip={null}>
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

          {/* 生成等待提示区 */}
          {generating && (
            <div style={{ 
              marginTop: 16, 
              padding: '16px', 
              background: '#f0f7ff', 
              borderRadius: 8,
              border: '1px solid #d6e8fa'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Spin size="small" />
                <Text strong style={{ color: '#1677ff' }}>{progress}</Text>
              </div>

              {/* 计时器 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ClockCircleOutlined style={{ color: '#666' }} />
                <Text type="secondary">
                  已等待 <Text strong style={{ color: '#1677ff' }}>{formatTime(elapsedTime)}</Text>
                </Text>
                {elapsedTime > 30 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    （首次生成通常需要 1-3 分钟）
                  </Text>
                )}
              </div>

              {/* 进度提示 */}
              {elapsedTime > 0 && elapsedTime < 15 && (
                <Progress 
                  percent={Math.min(90, elapsedTime * 6)} 
                  size="small" 
                  status="active"
                  showInfo={false}
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              )}
              {elapsedTime >= 15 && elapsedTime < 60 && (
                <Progress 
                  percent={Math.min(95, 70 + (elapsedTime - 15) * 0.5)} 
                  size="small" 
                  status="active"
                  showInfo={false}
                  strokeColor="#1677ff"
                />
              )}

              {/* 预估时间 */}
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                <ThunderboltOutlined /> 预计还需要 30-120 秒，取决于模型响应速度
              </div>

              {/* 流式内容预览 */}
              {streamContent && (
                <div style={{ 
                  marginTop: 12, 
                  padding: '8px 12px', 
                  background: '#fff', 
                  borderRadius: 4,
                  border: '1px solid #e8e8e8',
                  maxHeight: 120,
                  overflow: 'auto',
                  fontSize: 12,
                  color: '#666',
                  lineHeight: 1.6
                }}>
                  <div style={{ marginBottom: 4, fontWeight: 600, color: '#333' }}>📝 内容预览：</div>
                  {streamContent.slice(-500)}{streamContent.length > 500 && '...'}
                </div>
              )}
            </div>
          )}
        </div>
      </Spin>
    </Modal>
  );
}
