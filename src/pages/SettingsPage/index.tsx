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
    <div className="settings-page">
      <div className="settings-page__inner">
        <div className="settings-page__hero">
          <div className="settings-page__hero-top">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              className="settings-page__back"
            />
            <Title level={3} style={{ margin: 0 }}>⚙️ 设置中心</Title>
          </div>
          <p className="settings-page__hero-text">
            统一管理 AI Provider、阅读体验与常用预设，让创作与阅读流程更顺手。
          </p>
        </div>

        <div className="settings-page__section">
          <AIConfigSection
            form={form}
            aiConfigs={aiConfigs}
            editingId={editingId}
            backendOnline={backendOnline}
            modelInfoMap={modelInfoMap}
            setEditingId={setEditingId}
            onSave={handleSave}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSetActive={handleSetActive}
            onTest={handleTestConnection}
          />
        </div>

        <div className="settings-page__grid">
          <div className="settings-page__section">
            <ReadingPresets readingSettings={readingSettings} applyPreset={applyPreset} />
          </div>
          <div className="settings-page__section">
            <ReadingSettingsForm form={readingForm} onSave={handleSaveReadingSettings} />
          </div>
        </div>
      </div>
    </div>
  );
}
