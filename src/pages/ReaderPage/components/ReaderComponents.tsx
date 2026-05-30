/**
 * 阅读器组件
 */

import { Typography, Progress, Button, Drawer, Spin } from 'antd';
import {
  DownloadOutlined, ArrowLeftOutlined, ArrowRightOutlined,
  MenuOutlined, PlusOutlined, LoadingOutlined,
} from '@ant-design/icons';
import type { Book } from '@/types';

const { Text } = Typography;

// ============ 章节导航栏 ============

interface ChapterNavProps {
  chapters: { id: string; index: number; title: string }[];
  currentIndex: number;
  onJump: (index: number) => void;
  contentWidth: number;
}

export function ChapterNav({ chapters, currentIndex, onJump, contentWidth }: ChapterNavProps) {
  if (chapters.length <= 1) return null;
  const NEARBY = 4;
  const total = chapters.length;
  const start = Math.max(0, currentIndex - NEARBY);
  const end = Math.min(total - 1, currentIndex + NEARBY);
  const buttons: React.ReactNode[] = [];

  if (start > 0) {
    buttons.push(<Button key="first" size="small" onClick={() => onJump(0)}>1</Button>);
    if (start > 1) buttons.push(<span key="es" style={{ color: '#999', alignSelf: 'center' }}>…</span>);
  }
  for (let i = start; i <= end; i++) {
    const ch = chapters[i];
    if (!ch) continue;
    buttons.push(
      <Button key={ch.id} size="small" type={i === currentIndex ? 'primary' : 'default'} onClick={() => onJump(i)}>
        {ch.index}
      </Button>,
    );
  }
  if (end < total - 1) {
    if (end < total - 2) buttons.push(<span key="ee" style={{ color: '#999', alignSelf: 'center' }}>…</span>);
    const lastCh = chapters[total - 1];
    if (lastCh) buttons.push(<Button key="last" size="small" onClick={() => onJump(total - 1)}>{lastCh.index}</Button>);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap', maxWidth: contentWidth, margin: '0 auto 24px' }}>
      {buttons}
    </div>
  );
}

// ============ 进度条 ============

interface ProgressBarProps {
  currentIndex: number;
  totalChapters: number;
  onDownload: () => void;
  onTOCOpen: () => void;
}

export function ProgressBar({ currentIndex, totalChapters, onDownload, onTOCOpen }: ProgressBarProps) {
  const percent = Math.round(((currentIndex + 1) / Math.max(totalChapters, 1)) * 100);
  return (
    <div style={{ textAlign: 'center', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Button size="small" icon={<MenuOutlined />} onClick={onTOCOpen}>目录</Button>
      <Text type="secondary">{totalChapters} 章 · 已读到第 {currentIndex + 1} 章</Text>
      <Progress percent={percent} size="small" style={{ width: 120, margin: 0 }} />
      <Button size="small" icon={<DownloadOutlined />} onClick={onDownload}>下载</Button>
    </div>
  );
}

// ============ 追加生成区域 ============

interface AppendSectionProps {
  book: Book | null;
  appendLoading: boolean;
  appendProgress: string;
  appendElapsed: number;
  canAppend: boolean;
  currentChapterIndex: number;
  totalChapters: number;
  formatTime: (s: number) => string;
  onAppend: () => void;
}

export function AppendSection({ book, appendLoading, appendProgress, appendElapsed, canAppend, currentChapterIndex, totalChapters, formatTime, onAppend }: AppendSectionProps) {
  if (book?.type !== 'ai' || !book.aiConfig) return null;
  if (!appendLoading && !canAppend && currentChapterIndex < totalChapters - 1) return null;

  return (
    <div style={{ marginTop: 32, textAlign: 'center' }}>
      {(appendLoading || canAppend) && (
        <div style={{ padding: '24px 16px', borderTop: '1px dashed #d9d9d9' }}>
          {appendLoading ? (
            <div>
              <Spin indicator={<LoadingOutlined spin />} />
              <div style={{ marginTop: 12, color: '#666' }}>{appendProgress || 'AI 正在续写...'}</div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>
                已等待 <span style={{ color: '#1677ff', fontWeight: 600 }}>{formatTime(appendElapsed)}</span>
                {appendElapsed > 30 && <span> · 预计还需要 30-120 秒</span>}
              </div>
            </div>
          ) : canAppend ? (
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>📖 已接近最新章节，是否继续？</Text>
              <Button type="primary" icon={<PlusOutlined />} size="large" onClick={onAppend}>续写 2 章</Button>
            </div>
          ) : null}
        </div>
      )}
      {!appendLoading && !canAppend && currentChapterIndex >= totalChapters - 1 && (
        <div style={{ padding: '16px', color: '#999' }}>
          <Text type="secondary">继续阅读以触发自动续写，或</Text>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={onAppend} style={{ padding: '0 4px' }}>手动续写</Button>
        </div>
      )}
    </div>
  );
}

// ============ 章节目录 Drawer ============

interface TOCDrawerProps {
  open: boolean;
  chapters: { id: string; title: string }[];
  currentIndex: number;
  onJump: (index: number) => void;
  onClose: () => void;
}

export function TOCDrawer({ open, chapters, currentIndex, onJump, onClose }: TOCDrawerProps) {
  return (
    <Drawer title="章节目录" placement="left" closable onClose={onClose} open={open} width={280} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '8px 0' }}>
        {chapters.map((ch, i) => (
          <div key={ch.id} onClick={() => onJump(i)}
            style={{
              padding: '10px 20px', cursor: 'pointer',
              background: i === currentIndex ? '#e6f4ff' : 'transparent',
              color: i === currentIndex ? '#1677ff' : undefined,
              fontWeight: i === currentIndex ? 600 : 400,
              transition: 'all 0.2s', borderBottom: '1px solid #f0f0f0',
            }}
            onMouseEnter={(e) => { if (i !== currentIndex) e.currentTarget.style.background = '#f5f5f5'; }}
            onMouseLeave={(e) => { if (i !== currentIndex) e.currentTarget.style.background = 'transparent'; }}
          >{ch.title}</div>
        ))}
      </div>
    </Drawer>
  );
}

// ============ 底部导航 ============

interface BottomNavProps {
  currentIndex: number;
  totalChapters: number;
  onPrev: () => void;
  onNext: () => void;
}

export function BottomNav({ currentIndex, totalChapters, onPrev, onNext }: BottomNavProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-color, #e8e8e8)' }}>
      <Button disabled={currentIndex <= 0} onClick={onPrev} icon={<ArrowLeftOutlined />}>上一章</Button>
      <Text type="secondary" style={{ fontSize: 12 }}>← 上一章 · → 下一章 · PageUp/PageDown 翻页</Text>
      <Button disabled={currentIndex >= totalChapters - 1} onClick={onNext}>下一章<ArrowRightOutlined /></Button>
    </div>
  );
}
