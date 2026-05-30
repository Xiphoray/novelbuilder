/**
 * F-007: 设置页面
 */

import { useEffect } from 'react';
import { Typography, Form, App, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ReadingSettings } from '@/types';
import { useAIConfig } from './hooks/useAIConfig';
import { AIConfigSection } from './components/AIConfigSection';
import { ReadingPresets, ReadingSettingsForm } from './components/ReadingSettings';

const { Title } = Typography;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { readingSettings, updateReadingSettings } = useSettingsStore();
  const [form] = Form.useForm();
  const [readingForm] = Form.useForm();

  const {
    aiConfigs, editingId, backendOnline, modelInfoMap, setEditingId,
    handleSave, handleEdit, handleDelete, handleSetActive, handleTestConnection,
  } = useAIConfig();

  useEffect(() => { readingForm.setFieldsValue(readingSettings); }, [readingForm, readingSettings]);

  const handleSaveReadingSettings = async () => {
    try {
      const values = await readingForm.validateFields();
      updateReadingSettings(values);
      message.success('阅读设置已保存');
    } catch { /* validation */ }
  };

  const applyPreset = (preset: { name: string; settings: Partial<ReadingSettings> }) => {
    readingForm.setFieldsValue(preset.settings);
    updateReadingSettings(preset.settings);
    message.success(`已切换到「${preset.name}」`);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Title level={3} style={{ margin: 0 }}>⚙️ 设置</Title>
      </div>

      <AIConfigSection
        form={form} aiConfigs={aiConfigs} editingId={editingId} backendOnline={backendOnline}
        modelInfoMap={modelInfoMap} setEditingId={setEditingId}
        onSave={handleSave} onEdit={handleEdit} onDelete={handleDelete}
        onSetActive={handleSetActive} onTest={handleTestConnection}
      />

      <ReadingPresets readingSettings={readingSettings} applyPreset={applyPreset} />

      <ReadingSettingsForm form={readingForm} onSave={handleSaveReadingSettings} />
    </div>
  );
}
