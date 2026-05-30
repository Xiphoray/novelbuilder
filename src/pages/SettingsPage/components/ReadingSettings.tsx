/**
 * 阅读设置组件
 */

import { Form, Slider, Select, Radio, Button, Card, Space, Typography, Tag } from 'antd';
import { ThunderboltOutlined, SaveOutlined } from '@ant-design/icons';
import type { ThemeType, ReadingSettings } from '@/types';

const { Text } = Typography;

const themeOptions: { label: string; value: ThemeType }[] = [
  { label: '亮色', value: 'light' },
  { label: '暗色', value: 'dark' },
  { label: '护眼', value: 'eye-care' },
];

const READING_PRESETS = [
  {
    name: '默认模式', desc: '系统默认设置',
    settings: { fontSize: 18, lineHeight: 1.8, fontFamily: '-apple-system, "Microsoft YaHei", sans-serif', theme: 'light' as ThemeType, contentWidth: 800 },
  },
  {
    name: '舒适模式', desc: '大字号，宽松行距，护眼色',
    settings: { fontSize: 22, lineHeight: 2.0, fontFamily: '"KaiTi", serif', theme: 'eye-care' as ThemeType, contentWidth: 750 },
  },
  {
    name: '夜间模式', desc: '暗色主题，适合夜间阅读',
    settings: { fontSize: 18, lineHeight: 1.8, fontFamily: '-apple-system, "Microsoft YaHei", sans-serif', theme: 'dark' as ThemeType, contentWidth: 800 },
  },
  {
    name: '紧凑模式', desc: '小字号，窄行距，一次看更多',
    settings: { fontSize: 15, lineHeight: 1.4, fontFamily: '"Courier New", monospace', theme: 'light' as ThemeType, contentWidth: 900 },
  },
];

interface ReadingPresetsProps {
  readingSettings: ReadingSettings;
  applyPreset: (preset: typeof READING_PRESETS[number]) => void;
}

export function ReadingPresets({ readingSettings, applyPreset }: ReadingPresetsProps) {
  return (
    <Card title={<Space><ThunderboltOutlined />快速预设</Space>} style={{ marginBottom: 24 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        选择一个预设方案，快速切换阅读风格
      </Text>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {READING_PRESETS.map((preset) => {
          const isActive = readingSettings.fontSize === preset.settings.fontSize && readingSettings.theme === preset.settings.theme;
          return (
            <Card key={preset.name} hoverable size="small"
              style={{ width: 180, border: isActive ? '2px solid #1677ff' : '1px solid #e8e8e8', cursor: 'pointer' }}
              onClick={() => applyPreset(preset)}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {preset.name}
                {isActive && <Tag color="blue" style={{ marginLeft: 4 }}>当前</Tag>}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>{preset.desc}</Text>
              <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
                字号 {preset.settings.fontSize}px · 行距 {preset.settings.lineHeight}
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

interface ReadingSettingsFormProps {
  form: any;
  onSave: () => void;
}

export function ReadingSettingsForm({ form, onSave }: ReadingSettingsFormProps) {
  return (
    <Card title="📖 阅读设置" style={{ marginBottom: 24 }}>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="fontSize" label="字号 (px)">
          <Slider min={14} max={32} marks={{ 14: '14px', 18: '18px', 24: '24px', 32: '32px' }} />
        </Form.Item>
        <Form.Item name="lineHeight" label="行距">
          <Slider min={1.2} max={2.5} step={0.1} marks={{ 1.2: '1.2', 1.5: '1.5', 1.8: '1.8', 2.0: '2.0', 2.5: '2.5' }} />
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
          <Slider min={600} max={1200} step={50} marks={{ 600: '600px', 800: '800px', 1000: '1000px', 1200: '1200px' }} />
        </Form.Item>
        <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>保存阅读设置</Button>
      </Form>
    </Card>
  );
}
