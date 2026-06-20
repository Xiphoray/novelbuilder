/**
 * F-005: 创建 AI 书籍对话框
 */

import { useState } from 'react';
import { App, Modal, Input, Space, Typography, Spin, Alert } from 'antd';
import { RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGenerateNovel } from './useGenerateNovel';
import { GenerateProgress, StyleTagSelector } from './GenerateProgress';

const { TextArea } = Input;
const { Text } = Typography;

interface CreateAIDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateAIDialog({ open, onClose }: CreateAIDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  const { modal } = App.useApp();
  const navigate = useNavigate();
  const activeAIConfig = useSettingsStore((s) => s.activeAIConfig);
  const isAIConfigured = Boolean(activeAIConfig);

  const { generating, progress, elapsedTime, cancelGenerate, handleGenerate } = useGenerateNovel();

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  const goToSettings = () => {
    onClose();
    navigate('/settings');
  };

  const handleGenerateClick = async () => {
    // 生成中点击 = 停止
    if (generating) {
      cancelGenerate();
      return false;
    }

    // 前置校验：未配置 AI 时弹窗询问用户去设置，并阻止 onOk 关闭
    if (!isAIConfigured) {
      modal.confirm({
        title: '尚未配置 AI Provider',
        content: '需要先在设置中填写 Provider 类型、API Key、模型 ID 等信息，才能开始 AI 生成。',
        okText: '前往设置',
        cancelText: '稍后',
        onOk: () => {
          goToSettings();
        },
      });
      return false;
    }

    await handleGenerate(
      selectedTags,
      customPrompt,
      onClose,
      () => {
        setSelectedTags([]);
        setCustomPrompt('');
      },
    );
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
        if (generating) {
          cancelGenerate();
        }
        setSelectedTags([]);
        setCustomPrompt('');
        onClose();
      }}
      onOk={handleGenerateClick}
      okText={generating ? '停止生成' : '开始生成'}
      okButtonProps={generating ? { danger: true, icon: undefined } : {}}
      cancelText="取消"
      confirmLoading={false}
      closable
      maskClosable={false}
      width={560}
    >
      <Spin spinning={generating} tip={null}>
        <div style={{ minHeight: 200 }}>
          {!isAIConfigured && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="尚未配置 AI Provider"
              description="点击「开始生成」将引导你前往设置页填写 Provider 与 API Key。"
              action={
                <Space>
                  <SettingOutlined onClick={goToSettings} style={{ cursor: 'pointer' }} />
                </Space>
              }
            />
          )}
          <div style={{ marginBottom: 16 }}>
            <Text strong>选择风格类型：</Text>
            <div style={{ marginTop: 8 }}>
              <StyleTagSelector selectedTags={selectedTags} onToggle={handleTagToggle} />
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

          {/* 生成等待提示区 */}
          {generating && (
            <GenerateProgress
              progress={progress}
              elapsedTime={elapsedTime}
              formatTime={formatTime}
            />
          )}
        </div>
      </Spin>
    </Modal>
  );
}
