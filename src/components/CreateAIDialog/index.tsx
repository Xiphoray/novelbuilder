/**
 * F-005: 创建 AI 书籍对话框
 */

import { useState } from 'react';
import { Modal, Input, Space, Typography, Spin } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
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

  const { generating, progress, streamContent, elapsedTime, handleGenerate } = useGenerateNovel();

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  const handleGenerateClick = async () => {
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
        if (!generating) {
          setSelectedTags([]);
          setCustomPrompt('');
          onClose();
        }
      }}
      onOk={handleGenerateClick}
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
              streamContent={streamContent}
              formatTime={formatTime}
            />
          )}
        </div>
      </Spin>
    </Modal>
  );
}
