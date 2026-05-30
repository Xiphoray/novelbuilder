import { useEffect, useRef, useCallback, useState } from 'react';
import { Typography, Empty, Progress, Button, Drawer, FloatButton, Spin, App } from 'antd';
import {
  DownloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  MenuOutlined,
  ToTopOutlined,
  PlusOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { exportBookAsTxt } from '@/services/exportService';
import { appendChapters, generateSummary } from '@/services/aiService';
import type { Chapter } from '@/types';

const { Title, Paragraph } = Typography;

export default function ReaderPage() {
  const currentBook = useBookStore((s) => s.currentBook);
  const currentChapters = useBookStore((s) => s.currentChapters);
  const currentChapterIndex = useBookStore((s) => s.currentChapterIndex);
  const setCurrentChapterIndex = useBookStore((s) => s.setCurrentChapterIndex);
  const updateReadingProgress = useBookStore((s) => s.updateReadingProgress);
  const readingSettings = useSettingsStore((s) => s.readingSettings);

  const { message } = App.useApp();
  const [tocOpen, setTocOpen] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [appendLoading, setAppendLoading] = useState(false);
  const [appendProgress, setAppendProgress] = useState('');
  const [appendElapsed, setAppendElapsed] = useState(0);
  const [canAppend, setCanAppend] = useState(true);

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 根据主题设置获取 CSS 类名
  const themeClass =
    readingSettings.theme === 'dark'
      ? 'theme-dark'
      : readingSettings.theme === 'eye-care'
        ? 'theme-eye-care'
        : '';

  // 保存滚动位置（防抖 500ms）
  const saveScrollPosition = useCallback(() => {
    if (!currentBook || isRestoringRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        updateReadingProgress(
          currentBook.id,
          currentChapterIndex,
          container.scrollTop,
        );
      }
    }, 500);
  }, [currentBook, currentChapterIndex, updateReadingProgress]);

  // 监听滚动事件 + 回到顶部按钮显隐
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      saveScrollPosition();
      setShowBackTop(container.scrollTop > 200);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition]);

  // 切换章节时恢复滚动位置，或滚动到顶部
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isRestoringRef.current = true;

    // 如果有保存的进度且是当前章节，恢复滚动位置
    const savedOffset = currentBook?.readingProgress?.scrollOffset ?? 0;
    const savedChapter = currentBook?.readingProgress?.chapterIndex ?? 0;

    if (savedChapter === currentChapterIndex && savedOffset > 0) {
      // 使用 requestAnimationFrame 确保 DOM 已渲染
      requestAnimationFrame(() => {
        container.scrollTop = savedOffset;
        isRestoringRef.current = false;
      });
    } else {
      container.scrollTop = 0;
      isRestoringRef.current = false;
    }
  }, [currentChapterIndex, currentBook]);

  // 键盘翻页支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentBook || currentChapters.length === 0) return;

      // 如果焦点在输入框中，不处理
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentChapterIndex > 0) {
            setCurrentChapterIndex(currentChapterIndex - 1);
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentChapterIndex < currentChapters.length - 1) {
            setCurrentChapterIndex(currentChapterIndex + 1);
          }
          break;
        case 'PageUp':
          e.preventDefault();
          container.scrollBy({ top: -container.clientHeight * 0.8, behavior: 'smooth' });
          break;
        case 'PageDown':
          e.preventDefault();
          container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' });
          break;
        case 'Home':
          e.preventDefault();
          container.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBook, currentChapters, currentChapterIndex, setCurrentChapterIndex]);

  // 追加生成计时器
  useEffect(() => {
    if (!appendLoading) return;
    setAppendElapsed(0);
    const timer = setInterval(() => setAppendElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [appendLoading]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  // F-006: 追加生成处理
  const handleAppendGeneration = useCallback(async () => {
    if (!currentBook || appendLoading) return;
    if (currentBook.type !== 'ai' || !currentBook.aiConfig) return;

    setAppendLoading(true);
    setAppendProgress('正在准备上下文...');

    try {
      console.log('[Reader] 开始追加生成', {
        bookId: currentBook.id,
        title: currentBook.title,
        currentChapterCount: currentChapters.length,
      });

      // 获取最近3章内容
      const recentChapters = currentChapters.slice(-3).map((ch) => ({
        index: ch.index,
        title: ch.title,
        content: ch.content,
      }));

      // 生成摘要（如果有摘要则使用，否则用 style + prompt）
      let summary = currentBook.summary || '';
      if (!summary && currentChapters.length > 3) {
        setAppendProgress('正在生成内容摘要...');
        try {
          const summaryResult = await generateSummary({
            bookTitle: currentBook.title,
            chapters: currentChapters.slice(0, -3).map((ch) => ({
              title: ch.title,
              content: ch.content,
            })),
          });
          summary = summaryResult.summary;
          console.log('[Reader] 摘要生成完成', { summaryLength: summary.length });
        } catch (err) {
          console.warn('[Reader] 摘要生成失败，使用原始摘要', err);
        }
      }

      setAppendProgress('AI 正在续写章节...');

      const result = await appendChapters({
        bookId: currentBook.id,
        bookTitle: currentBook.title,
        style: currentBook.aiConfig.style,
        summary,
        recentChapters,
        currentChapterCount: currentChapters.length,
      });

      if (result.chapters.length === 0) {
        message.warning('AI 未能生成新章节');
        return;
      }

      setAppendProgress('正在保存新章节...');

      // 保存新章节到数据库
      const { v4: uuidv4 } = await import('uuid');
      const newChapters: Chapter[] = result.chapters.map((ch) => ({
        id: uuidv4(),
        bookId: currentBook.id,
        index: ch.index,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
        status: 'complete' as const,
        createdAt: Date.now(),
      }));

      // 更新 bookStore
      const { appendChapters: storeAppendChapters } = useBookStore.getState();
      await storeAppendChapters(currentBook.id, newChapters);

      console.log('[Reader] 追加生成完成', {
        newChapterCount: newChapters.length,
        totalChapters: currentChapters.length + newChapters.length,
      });

      message.success(`已续写 ${newChapters.length} 章，共 ${currentChapters.length + newChapters.length} 章`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '追加生成失败';
      console.error('[Reader] 追加生成失败:', err);
      message.error(errorMsg);
    } finally {
      setAppendLoading(false);
      setAppendProgress('');
    }
  }, [currentBook, currentChapters, appendLoading, message]);

  // 滚动检测：读到最后一章 80% 时提示追加生成
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !currentBook || currentBook.type !== 'ai') return;

    const handleScroll = () => {
      const isLastChapter = currentChapterIndex >= currentChapters.length - 1;
      if (!isLastChapter || appendLoading) {
        setCanAppend(false);
        return;
      }

      const scrollPercent = container.scrollTop / (container.scrollHeight - container.clientHeight);
      setCanAppend(scrollPercent > 0.6);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentChapterIndex, currentChapters.length, currentBook, appendLoading]);

  // 点击"下一章"时检查是否需要触发 AI 追加生成
  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < currentChapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  }, [currentChapterIndex, currentChapters.length, setCurrentChapterIndex]);

  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  }, [currentChapterIndex, setCurrentChapterIndex]);

  // 下载书籍（适用于所有类型）
  const handleDownload = () => {
    if (!currentBook) return;
    exportBookAsTxt(currentBook, currentChapters);
  };

  // 目录跳转
  const handleTOCJump = (index: number) => {
    setCurrentChapterIndex(index);
    setTocOpen(false);
  };

  // 回到顶部
  const handleBackToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 空状态
  if (!currentBook) {
    return (
      <div
        className={themeClass}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Empty description={null} />
        <Typography.Text type="secondary" style={{ fontSize: 16 }}>
          📖 请从书库中选择一本书，或导入/创建一本新书
        </Typography.Text>
      </div>
    );
  }

  const currentChapter = currentChapters[currentChapterIndex];
  const readPercent = Math.round(
    ((currentChapterIndex + 1) / Math.max(currentChapters.length, 1)) * 100,
  );

  return (
    <div
      ref={scrollContainerRef}
      className={themeClass}
      style={{
        height: '100%',
        overflow: 'auto',
        transition: 'background-color 0.3s, color 0.3s',
      }}
    >
      <div
        ref={contentRef}
        style={{
          maxWidth: readingSettings.contentWidth,
          margin: '0 auto',
          padding: '24px 48px',
          fontFamily: readingSettings.fontFamily,
          fontSize: readingSettings.fontSize,
          lineHeight: readingSettings.lineHeight,
          minHeight: '100%',
        }}
      >
        {/* 书名 */}
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 8,
            transition: 'color 0.3s',
          }}
        >
          {currentBook.title}
        </Title>

        {/* 进度信息栏 */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Button
            size="small"
            icon={<MenuOutlined />}
            onClick={() => setTocOpen(true)}
          >
            目录
          </Button>
          <Typography.Text type="secondary">
            {currentChapters.length} 章 · 已读到第 {currentChapterIndex + 1} 章
          </Typography.Text>
          <Progress
            percent={readPercent}
            size="small"
            style={{ width: 120, margin: 0 }}
          />
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载
          </Button>
        </div>

        {/* 章节快速跳转条：显示当前章节及前后四章 */}
        {currentChapters.length > 1 && (() => {
          const NEARBY = 4;
          const total = currentChapters.length;
          const start = Math.max(0, currentChapterIndex - NEARBY);
          const end = Math.min(total - 1, currentChapterIndex + NEARBY);
          const buttons: React.ReactNode[] = [];

          // 始终显示第一章
          if (start > 0) {
            buttons.push(
              <Button
                key="first"
                size="small"
                type="default"
                onClick={() => setCurrentChapterIndex(0)}
              >
                1
              </Button>,
            );
            if (start > 1) {
              buttons.push(
                <span key="ellipsis-start" style={{ color: '#999', alignSelf: 'center' }}>…</span>,
              );
            }
          }

          // 显示当前章节附近的按钮
          for (let i = start; i <= end; i++) {
            const ch = currentChapters[i];
            if (!ch) continue;
            buttons.push(
              <Button
                key={ch.id}
                size="small"
                type={i === currentChapterIndex ? 'primary' : 'default'}
                onClick={() => setCurrentChapterIndex(i)}
              >
                {ch.index}
              </Button>,
            );
          }

          // 始终显示最后一章
          if (end < total - 1) {
            if (end < total - 2) {
              buttons.push(
                <span key="ellipsis-end" style={{ color: '#999', alignSelf: 'center' }}>…</span>,
              );
            }
            const lastCh = currentChapters[total - 1];
            if (lastCh) {
              buttons.push(
                <Button
                  key="last"
                  size="small"
                  type="default"
                  onClick={() => setCurrentChapterIndex(total - 1)}
                >
                  {lastCh.index}
                </Button>,
              );
            }
          }

          return (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginBottom: 24,
                flexWrap: 'wrap',
                maxWidth: readingSettings.contentWidth,
                margin: '0 auto 24px',
              }}
            >
              {buttons}
            </div>
          );
        })()}

        {/* 章节内容 */}
        {currentChapter ? (
          <div>
            <Title
              level={4}
              style={{ marginBottom: 24, transition: 'color 0.3s' }}
            >
              {currentChapter.title}
            </Title>
            {currentChapter.content.split(/\n/).map((para, i) => (
              <Paragraph
                key={i}
                style={{
                  textIndent: '2em',
                  marginBottom: '0.8em',
                  transition: 'color 0.3s',
                }}
              >
                {para}
              </Paragraph>
            ))}
          </div>
        ) : (
          <Empty description="章节加载失败" />
        )}

        {/* F-006: AI 追加生成提示区 */}
        {currentBook.type === 'ai' && currentBook.aiConfig && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            {(appendLoading || canAppend) && (
              <div
                style={{
                  padding: '24px 16px',
                  borderTop: '1px dashed #d9d9d9',
                }}
              >
                {appendLoading ? (
                  <div>
                    <Spin indicator={<LoadingOutlined spin />} />
                    <div style={{ marginTop: 12, color: '#666' }}>
                      {appendProgress || 'AI 正在续写...'}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>
                      已等待 <span style={{ color: '#1677ff', fontWeight: 600 }}>{formatTime(appendElapsed)}</span>
                      {appendElapsed > 30 && (
                        <span> · 预计还需要 30-120 秒</span>
                      )}
                    </div>
                  </div>
                ) : canAppend ? (
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      📖 已接近最新章节，是否继续？
                    </Typography.Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      size="large"
                      onClick={handleAppendGeneration}
                    >
                      续写 3 章
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {!appendLoading && !canAppend && currentChapterIndex >= currentChapters.length - 1 && (
              <div style={{ padding: '16px', color: '#999' }}>
                <Typography.Text type="secondary">
                  继续阅读以触发自动续写，或
                </Typography.Text>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAppendGeneration}
                  style={{ padding: '0 4px' }}
                >
                  手动续写
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 底部导航 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 24,
            paddingTop: 24,
            borderTop: '1px solid var(--border-color, #e8e8e8)',
          }}
        >
          <Button
            disabled={currentChapterIndex <= 0}
            onClick={handlePrevChapter}
            icon={<ArrowLeftOutlined />}
          >
            上一章
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ← 上一章 · → 下一章 · PageUp/PageDown 翻页
          </Typography.Text>
          <Button
            disabled={currentChapterIndex >= currentChapters.length - 1}
            onClick={handleNextChapter}
          >
            下一章
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>
      {/* 章节目录面板 */}
      <Drawer
        title="章节目录"
        placement="left"
        closable
        onClose={() => setTocOpen(false)}
        open={tocOpen}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '8px 0' }}>
          {currentChapters.map((ch, i) => (
            <div
              key={ch.id}
              onClick={() => handleTOCJump(i)}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                background: i === currentChapterIndex ? '#e6f4ff' : 'transparent',
                color: i === currentChapterIndex ? '#1677ff' : undefined,
                fontWeight: i === currentChapterIndex ? 600 : 400,
                transition: 'all 0.2s',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => {
                if (i !== currentChapterIndex) {
                  e.currentTarget.style.background = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (i !== currentChapterIndex) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {ch.title}
            </div>
          ))}
        </div>
      </Drawer>

      {/* 回到顶部浮动按钮 */}
      <FloatButton
        icon={<ToTopOutlined />}
        onClick={handleBackToTop}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 80,
          opacity: showBackTop ? 1 : 0,
          pointerEvents: showBackTop ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      />
    </div>
  );
}
