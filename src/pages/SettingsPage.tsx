import { useState, useEffect } from 'react';
import {
  Typography,
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  Slider,
  Radio,
  App,
  Divider,
  Tag,
  Progress,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AIProviderConfig, AIProviderType, ThemeType, ReadingSettings } from '@/types';
import { db } from '@/services/db';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    aiConfigs,
    readingSettings,
    addAIConfig,
    updateAIConfig,
    deleteAIConfig,
    updateReadingSettings,
  } = useSettingsStore();
  const [form] = Form.useForm();
  const [readingForm] = Form.useForm();

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    readingForm.setFieldsValue(readingSettings);
  }, [readingForm, readingSettings]);

  const handleSaveAIConfig = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await updateAIConfig({ ...values, id: editingId } as AIProviderConfig);
        message.success('AI 配置已更新');
      } else {
        const newConfig: AIProviderConfig = {
          ...(values as Omit<AIProviderConfig, 'id'>),
          id: uuidv4(),
        };
        await addAIConfig(newConfig);
        message.success('AI 配置已添加');
      }
      form.resetFields();
      setEditingId(null);
    } catch {
      message.error('请填写完整信息');
    }
  };

  const handleEditAIConfig = (config: AIProviderConfig) => {
    setEditingId(config.id);
    form.setFieldsValue(config);
  };

  const handleDeleteAIConfig = async (id: string) => {
    await deleteAIConfig(id);
    if (editingId === id) {
      setEditingId(null);
      form.resetFields();
    }
    message.success('AI 配置已删除');
  };

  const handleSaveReadingSettings = async () => {
    try {
      const values = await readingForm.validateFields();
      updateReadingSettings(values);
      message.success('阅读设置已保存');
    } catch {
      // validation failed
    }
  };

  /** 将 baseUrl 转为 Vite 代理路径（仅开发环境），解决 CORS 跨域问题 */
  const getProxiedUrl = (url: string): string => {
    if (import.meta.env.DEV) {
      try {
        const urlObj = new URL(url);
        return `/ai-api${urlObj.pathname}${urlObj.search}`;
      } catch {
        return url;
      }
    }
    return url;
  };

  const handleTestConnection = async () => {
    try {
      const values = form.getFieldsValue();
      const { baseUrl, provider } = values as AIProviderConfig;
      const apiKey = (values as { apiKey?: string }).apiKey;

      // 手动检查关键字段
      if (!baseUrl) {
        message.error('请填写 API Base URL');
        return;
      }
      if (!provider) {
        message.error('请选择 Provider 类型');
        return;
      }
      if (!apiKey) {
        message.error('请填写 API Key');
        return;
      }

      const loadingKey = 'test';
      message.loading({ content: '测试连接中...', key: loadingKey, duration: 0 });

      const headers: Record<string, string> = {};

      if (provider === 'anthropic') {
        // Anthropic API: 使用 x-api-key 头
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['content-type'] = 'application/json';
      } else {
        // OpenAI / OpenAI Compatible: 使用 Authorization Bearer
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const fetchUrl = getProxiedUrl(baseUrl);

      // 尝试 /models 端点
      let modelsSuccess = false;
      let modelList: string[] = [];

      try {
        const res = await fetch(`${fetchUrl}/models`, { headers });
        if (res.ok) {
          const data = await res.json();
          modelsSuccess = true;
          // 解析模型列表（OpenAI 格式：{ data: [{ id: "xxx" }] }）
          if (data?.data && Array.isArray(data.data)) {
            modelList = data.data.map((m: { id: string }) => m.id).filter(Boolean);
          }
        }
      } catch {
        // /models 端点不可用，继续尝试 chat completion
      }

      // 如果 /models 不可用，尝试发送一个简单的 chat completion 请求
      if (!modelsSuccess) {
        let chatUrl = `${fetchUrl}/chat/completions`;
        const chatHeaders: Record<string, string> = { ...headers, 'Content-Type': 'application/json' };

        if (provider === 'anthropic') {
          // Anthropic 使用 /messages 端点
          chatUrl = `${fetchUrl}/messages`;
          chatHeaders['anthropic-version'] = '2023-06-01';
          chatHeaders['content-type'] = 'application/json';

          const chatRes = await fetch(chatUrl, {
            method: 'POST',
            headers: chatHeaders,
            body: JSON.stringify({
              model: (values as AIProviderConfig).modelId || 'claude-3-haiku-20240307',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
          });

          if (chatRes.ok) {
            const chatData = await chatRes.json();
            const modelName = chatData?.model || (values as AIProviderConfig).modelId;
            message.success({
              content: `✅ 连接成功！模型：${modelName}`,
              key: loadingKey,
              duration: 5,
            });
            return;
          } else {
            const errText = await chatRes.text().catch(() => '');
            let errMsg = `HTTP ${chatRes.status}`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson?.error?.message || errMsg;
            } catch { /* ignore */ }
            message.error({ content: `连接失败：${errMsg}`, key: loadingKey, duration: 5 });
            return;
          }
        } else {
          // OpenAI / OpenAI Compatible
          const chatRes = await fetch(chatUrl, {
            method: 'POST',
            headers: chatHeaders,
            body: JSON.stringify({
              model: (values as AIProviderConfig).modelId || 'gpt-3.5-turbo',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
          });

          if (chatRes.ok) {
            const chatData = await chatRes.json();
            const modelName = chatData?.model || (values as AIProviderConfig).modelId;
            message.success({
              content: `✅ 连接成功！模型：${modelName}`,
              key: loadingKey,
              duration: 5,
            });
            return;
          } else {
            const errText = await chatRes.text().catch(() => '');
            let errMsg = `HTTP ${chatRes.status}`;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson?.error?.message || errMsg;
            } catch { /* ignore */ }
            message.error({ content: `连接失败：${errMsg}`, key: loadingKey, duration: 5 });
            return;
          }
        }
      }

      // /models 成功
      const modelInfo = modelList.length > 0
        ? `，可用模型 ${modelList.length} 个：${modelList.slice(0, 5).join(', ')}${modelList.length > 5 ? '...' : ''}`
        : '';
      message.success({
        content: `✅ 连接成功！${modelInfo}`,
        key: loadingKey,
        duration: 8,
      });
    } catch (err) {
      console.error('[testConnection]', err);
      message.error({ content: '连接测试出错，请检查网络或配置', key: 'test' });
    }
  };

  // 存储使用情况
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [storageAvailable, setStorageAvailable] = useState<number>(1);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          setStorageUsage(estimate.usage || 0);
          setStorageAvailable(estimate.quota || 1);
        }
      } catch {
        // 忽略
      }
    };
    loadStorageInfo();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const storagePercent = Math.min(
    Math.round((storageUsage / Math.max(storageAvailable, 1)) * 100),
    100,
  );
  const storageWarning = storagePercent > 80;
  const storageCritical = storagePercent > 90;

  /** 清理已删除书籍的残留章节数据 */
  const handleCleanupOrphanData = async () => {
    setClearing(true);
    try {
      const books = await db.books.toArray();
      const bookIds = new Set(books.map((b) => b.id));

      let deletedChapters = 0;

      // 清理无主章节
      const orphanChapters = await db.chapters
        .filter((ch) => !bookIds.has(ch.bookId))
        .toArray();
      deletedChapters = orphanChapters.length;
      if (deletedChapters > 0) {
        const orphanIds = orphanChapters.map((c) => c.id);
        await db.chapters.bulkDelete(orphanIds);
      }

      // 清理无主 AI 生成历史
      let deletedHistory = 0;
      const orphanHistory = await db.generationHistory
        .filter((h) => !bookIds.has(h.bookId))
        .toArray();
      deletedHistory = orphanHistory.length;
      if (deletedHistory > 0) {
        const histIds = orphanHistory.map((h) => h.id);
        await db.generationHistory.bulkDelete(histIds);
      }

      message.success(`清理完成：删除 ${deletedChapters} 个残留章节，${deletedHistory} 条残留生成历史`);

      // 刷新存储信息
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage(estimate.usage || 0);
        setStorageAvailable(estimate.quota || 1);
      }
    } catch {
      message.error('清理失败');
    } finally {
      setClearing(false);
    }
  };

  // 阅读预设方案
  const READING_PRESETS: { name: string; desc: string; settings: Partial<ReadingSettings> }[] = [
    {
      name: '默认模式',
      desc: '系统默认设置',
      settings: { fontSize: 18, lineHeight: 1.8, fontFamily: '-apple-system, "Microsoft YaHei", sans-serif', theme: 'light', contentWidth: 800 },
    },
    {
      name: '舒适模式',
      desc: '大字号，宽松行距，护眼色',
      settings: { fontSize: 22, lineHeight: 2.0, fontFamily: '"KaiTi", serif', theme: 'eye-care', contentWidth: 750 },
    },
    {
      name: '夜间模式',
      desc: '暗色主题，适合夜间阅读',
      settings: { fontSize: 18, lineHeight: 1.8, fontFamily: '-apple-system, "Microsoft YaHei", sans-serif', theme: 'dark', contentWidth: 800 },
    },
    {
      name: '紧凑模式',
      desc: '小字号，窄行距，一次看更多',
      settings: { fontSize: 15, lineHeight: 1.4, fontFamily: '"Courier New", monospace', theme: 'light', contentWidth: 900 },
    },
  ];

  const applyPreset = (preset: typeof READING_PRESETS[number]) => {
    readingForm.setFieldsValue(preset.settings);
    updateReadingSettings(preset.settings);
    message.success(`已切换到「${preset.name}」`);
  };

  const providerOptions = [
    { label: 'OpenAI', value: 'openai' as AIProviderType },
    { label: 'OpenAI Compatible', value: 'openai-compatible' as AIProviderType },
    { label: 'Anthropic', value: 'anthropic' as AIProviderType },
  ];

  const themeOptions: { label: string; value: ThemeType }[] = [
    { label: '亮色', value: 'light' },
    { label: '暗色', value: 'dark' },
    { label: '护眼', value: 'eye-care' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Title level={3} style={{ margin: 0 }}>
          ⚙️ 设置
        </Title>
      </div>

      {/* AI Provider Settings */}
      <Card
        title={
          <Space>
            <ApiOutlined />
            AI Provider 配置
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true }]}>
            <Input placeholder="如：我的 OpenAI" />
          </Form.Item>
          <Form.Item name="provider" label="Provider 类型" rules={[{ required: true }]}>
            <Select options={providerOptions} placeholder="选择 Provider" />
          </Form.Item>
          <Form.Item name="baseUrl" label="API Base URL" rules={[{ required: true }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={editingId ? [] : [{ required: true }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item name="modelId" label="模型 ID" rules={[{ required: true }]}>
            <Input placeholder="如：gpt-4o, claude-3-opus-20240229" />
          </Form.Item>
          <Form.Item name="isActive" label="启用" initialValue={true}>
            <Radio.Group>
              <Radio value={true}>是</Radio>
              <Radio value={false}>否</Radio>
            </Radio.Group>
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAIConfig}>
              {editingId ? '更新配置' : '添加配置'}
            </Button>
            <Button onClick={handleTestConnection}>测试连接</Button>
            {editingId && (
              <Button
                danger
                onClick={() => {
                  setEditingId(null);
                  form.resetFields();
                }}
              >
                取消编辑
              </Button>
            )}
          </Space>
        </Form>

        <Divider />

        <Text strong>已保存的配置：</Text>
        {aiConfigs.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            暂无配置
          </Text>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiConfigs.map((config) => (
              <Card
                key={config.id}
                size="small"
                style={{ background: config.isActive ? '#f6ffed' : '#fafafa' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <Text strong>{config.name}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      [{config.provider}] {config.modelId}
                    </Text>
                  </div>
                  <Space>
                    <Button size="small" onClick={() => handleEditAIConfig(config)}>
                      编辑
                    </Button>
                    <Button size="small" danger onClick={() => handleDeleteAIConfig(config.id)}>
                      删除
                    </Button>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Reading Settings Presets (F-003) */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            快速预设
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          选择一个预设方案，快速切换阅读风格（点击即应用并保存）
        </Text>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {READING_PRESETS.map((preset) => {
            const isActive =
              readingSettings.fontSize === preset.settings.fontSize &&
              readingSettings.theme === preset.settings.theme;
            return (
              <Card
                key={preset.name}
                hoverable
                size="small"
                style={{
                  width: 180,
                  border: isActive ? '2px solid #1677ff' : '1px solid #e8e8e8',
                  cursor: 'pointer',
                }}
                onClick={() => applyPreset(preset)}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {preset.name}
                  {isActive && <Tag color="blue" style={{ marginLeft: 4 }}>当前</Tag>}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {preset.desc}
                </Text>
                <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
                  字号 {preset.settings.fontSize}px · 行距 {preset.settings.lineHeight}
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Reading Settings */}
      <Card title="📖 阅读设置" style={{ marginBottom: 24 }}>
        <Form form={readingForm} layout="vertical" requiredMark={false}>
          <Form.Item name="fontSize" label="字号 (px)">
            <Slider min={14} max={32} marks={{ 14: '14px', 18: '18px', 24: '24px', 32: '32px' }} />
          </Form.Item>
          <Form.Item name="lineHeight" label="行距">
            <Slider
              min={1.2}
              max={2.5}
              step={0.1}
              marks={{ 1.2: '1.2', 1.5: '1.5', 1.8: '1.8', 2.0: '2.0', 2.5: '2.5' }}
            />
          </Form.Item>
          <Form.Item name="fontFamily" label="字体">
            <Select
              options={[
                { label: '系统默认', value: '-apple-system, "Microsoft YaHei", sans-serif' },
                { label: '宋体', value: '"SimSun", serif' },
                { label: '楷体', value: '"KaiTi", serif' },
                { label: '等宽字体', value: '"Courier New", monospace' },
              ]}
            />
          </Form.Item>
          <Form.Item name="theme" label="主题">
            <Radio.Group options={themeOptions} />
          </Form.Item>
          <Form.Item name="contentWidth" label="内容宽度 (px)">
            <Slider
              min={600}
              max={1200}
              step={50}
              marks={{ 600: '600px', 800: '800px', 1000: '1000px', 1200: '1200px' }}
            />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveReadingSettings}>
            保存阅读设置
          </Button>
        </Form>
      </Card>

      {/* Storage Warning (F-007) */}
      <Card
        title="💾 存储管理"
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text>已用空间：</Text>
          <Text strong>{formatBytes(storageUsage)}</Text>
          <Text type="secondary"> / {formatBytes(storageAvailable)}</Text>
        </div>
        <Progress
          percent={storagePercent}
          status={storageCritical ? 'exception' : storageWarning ? 'active' : 'normal'}
          strokeColor={storageCritical ? '#ff4d4f' : storageWarning ? '#faad14' : '#1677ff'}
          style={{ marginBottom: 12 }}
        />
        {storageWarning && (
          <div style={{ marginBottom: 12 }}>
            <Tag color={storageCritical ? 'red' : 'orange'}>
              {storageCritical ? '⚠️ 存储空间严重不足！' : '⚠️ 存储空间不足'}
            </Tag>
          </div>
        )}
        <Space>
          <Tooltip title="清理无主数据（删除的书籍残留的章节和日志数据）">
            <Button
              icon={<ClearOutlined />}
              onClick={handleCleanupOrphanData}
              loading={clearing}
            >
              清理残留数据
            </Button>
          </Tooltip>
        </Space>
      </Card>
    </div>
  );
}
