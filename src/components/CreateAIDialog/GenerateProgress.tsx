/**
 * AI 生成进度显示组件
 */

import { Spin, Progress, Typography, Tag } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface GenerateProgressProps {
  progress: string;
  elapsedTime: number;
  formatTime: (seconds: number) => string;
}

export function GenerateProgress({ progress, elapsedTime, formatTime }: GenerateProgressProps) {
  return (
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
    </div>
  );
}

interface StyleTagSelectorProps {
  selectedTags: string[];
  onToggle: (tag: string) => void;
}

export function StyleTagSelector({ selectedTags, onToggle }: StyleTagSelectorProps) {
  const HOT_STYLE_TAGS = [
    '玄幻', '都市', '仙侠', '武侠', '科幻', '历史', '游戏', '军事',
    '悬疑', '灵异', '同人', '穿越', '重生', '系统', '无敌流', '搞笑',
    '热血', '种田', '日常', '恋爱', '恐怖', '末日', '废土', '赛博朋克',
  ];

  return (
    <div>
      {HOT_STYLE_TAGS.map((tag) => (
        <Tag.CheckableTag
          key={tag}
          checked={selectedTags.includes(tag)}
          onChange={() => onToggle(tag)}
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
  );
}
