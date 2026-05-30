/**
 * AI 配置组件
 */

import { Form, Input, Select, Button, Space, Card, Divider, Typography, Tag, Radio } from 'antd';
import { ApiOutlined, SaveOutlined } from '@ant-design/icons';
import type { AIProviderConfig, AIProviderType } from '@/types';

const { Text } = Typography;

interface AIConfigSectionProps {
  form: any;
  aiConfigs: AIProviderConfig[];
  editingId: string | null;
  backendOnline: boolean;
  modelInfoMap: Record<string, { maxTokens?: number; contextLength?: number }>;
  setEditingId: (id: string | null) => void;
  onSave: (form: any) => void;
  onEdit: (config: AIProviderConfig, form: any) => void;
  onDelete: (id: string, form: any) => void;
  onSetActive: (config: AIProviderConfig) => void;
  onTest: (form: any) => void;
}

const providerOptions = [
  { label: 'OpenAI', value: 'openai' as AIProviderType },
  { label: 'OpenAI Compatible', value: 'openai-compatible' as AIProviderType },
  { label: 'Anthropic', value: 'anthropic' as AIProviderType },
];

export function AIConfigSection({
  form, aiConfigs, editingId, backendOnline, modelInfoMap,
  setEditingId, onSave, onEdit, onDelete, onSetActive, onTest,
}: AIConfigSectionProps) {
  return (
    <Card
      title={
        <Space>
          <ApiOutlined />
          AI Provider 配置
          {backendOnline ? <Tag color="green">后端在线</Tag> : <Tag color="red">后端离线</Tag>}
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
        <Form.Item name="apiKey" label="API Key" rules={editingId ? [] : [{ required: true }]}>
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item name="modelId" label="模型 ID" rules={[{ required: true }]}>
          <Input placeholder="如：gpt-4o" />
        </Form.Item>
        <Form.Item name="isActive" label="启用" initialValue={true}>
          <Radio.Group><Radio value={true}>是</Radio><Radio value={false}>否</Radio></Radio.Group>
        </Form.Item>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => onSave(form)}>
            {editingId ? '更新配置' : '添加配置'}
          </Button>
          <Button onClick={() => onTest(form)}>测试连接</Button>
          {editingId && <Button danger onClick={() => { setEditingId(null); form.resetFields(); }}>取消编辑</Button>}
        </Space>
      </Form>

      <Divider />
      <Text strong>已保存的配置：</Text>
      {aiConfigs.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>暂无配置</Text>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {aiConfigs.map((config) => (
            <Card key={config.id} size="small" style={{ background: config.isActive ? '#f6ffed' : '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>{config.name}</Text>
                  {config.isActive && <Tag color="green" style={{ marginLeft: 4 }}>活跃</Tag>}
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>[{config.provider}] {config.modelId}</Text>
                  {(() => {
                    const mi = modelInfoMap[config.id];
                    if (!mi) return null;
                    return (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {mi.contextLength && <span>上下文: {(mi.contextLength / 1024).toFixed(0)}K</span>}
                        {mi.contextLength && mi.maxTokens && <span> · </span>}
                        {mi.maxTokens && <span>最大输出: {mi.maxTokens.toLocaleString()} tokens</span>}
                      </div>
                    );
                  })()}
                </div>
                <Space>
                  {!config.isActive && <Button size="small" type="primary" onClick={() => onSetActive(config)}>设为活跃</Button>}
                  <Button size="small" onClick={() => onEdit(config, form)}>编辑</Button>
                  <Button size="small" danger onClick={() => onDelete(config.id, form)}>删除</Button>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
