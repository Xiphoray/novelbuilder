/**
 * F-003: 阅读器页面
 */

import { useMemo } from 'react';
import { Typography, Empty, FloatButton } from 'antd';
import { ToTopOutlined } from '@ant-design/icons';
import { exportBookAsTxt } from '@/services/exportService';
import { useReaderState } from './hooks/useReaderState';
import { useAppendGeneration } from './hooks/useAppendGeneration';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { ChapterNav, ProgressBar, AppendSection, TOCDrawer, BottomNav } from './components/ReaderComponents';

const { Title, Paragraph, Text } = Typography;

export default function ReaderPage() {
  const reader = useReaderState();
  const {
    handleAppend,
    cancelAppend,
    retryAppend,
    appendStatus,
    appendError,
    canRetry,
  } = useAppendGeneration(reader);
  useKeyboardNav(reader);

  const {
    currentBook, currentChapters, currentChapterIndex, readingSettings,
    tocOpen, setTocOpen, showBackTop, appendLoading, appendProgress,
    appendElapsed, canAppend, themeClass, scrollContainerRef,
    formatTime, handlePrevChapter, handleNextChapter, handleTOCJump, handleBackToTop,
  } = reader;

  const currentChapter = currentChapters[currentChapterIndex];
  const currentChapterParagraphs = useMemo(() => {
    if (!currentChapter) return [];
    return currentChapter.content
      .split(/\n/)
      .map((para) => para.trim())
      .filter(Boolean);
  }, [currentChapter?.id, currentChapter?.content]);

  const handleDownload = () => {
    if (!currentBook) return;
    exportBookAsTxt(currentBook, currentChapters);
  };

  if (!currentBook) {
    return (
      <div className={`${themeClass} reader-page reader-page--empty`} style={{ height: '100%' }}>
        <Empty description={null} />
        <Text type="secondary" style={{ fontSize: 16 }}>📖 请从书库中选择一本书</Text>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className={`${themeClass} reader-page`} style={{ height: '100%', overflow: 'auto', transition: 'background-color 0.3s, color 0.3s' }}>
      <div
        className="reader-page__content"
        style={{
          maxWidth: readingSettings.contentWidth,
          fontFamily: readingSettings.fontFamily,
          fontSize: readingSettings.fontSize,
          lineHeight: readingSettings.lineHeight,
        }}
      >
        <Title level={3} className="reader-page__book-title" style={{ transition: 'color 0.3s' }}>{currentBook.title}</Title>

        <ProgressBar
          currentIndex={currentChapterIndex} totalChapters={currentChapters.length}
          onDownload={handleDownload} onTOCOpen={() => setTocOpen(true)}
        />

        <ChapterNav
          chapters={currentChapters} currentIndex={currentChapterIndex}
          onJump={handleTOCJump} contentWidth={readingSettings.contentWidth}
        />

        {currentChapter ? (
          <div className="reader-page__chapter">
            <Title level={4} className="reader-page__chapter-title" style={{ transition: 'color 0.3s' }}>{currentChapter.title}</Title>
            {currentChapterParagraphs.map((para, i) => (
              <Paragraph key={i} className="reader-page__paragraph" style={{ transition: 'color 0.3s' }}>{para}</Paragraph>
            ))}
          </div>
        ) : <Empty description="章节加载失败" />}

        <AppendSection
          book={currentBook}
          appendLoading={appendLoading}
          appendProgress={appendProgress}
          appendElapsed={appendElapsed}
          canAppend={canAppend}
          currentChapterIndex={currentChapterIndex}
          totalChapters={currentChapters.length}
          formatTime={formatTime}
          onAppend={() => { void handleAppend(); }}
          onCancelAppend={cancelAppend}
          onRetryAppend={() => { void retryAppend(); }}
          appendStatus={appendStatus}
          appendError={appendError}
          canRetry={canRetry}
        />

        <BottomNav
          currentIndex={currentChapterIndex} totalChapters={currentChapters.length}
          onPrev={handlePrevChapter} onNext={handleNextChapter}
        />
      </div>

      <TOCDrawer
        open={tocOpen} chapters={currentChapters} currentIndex={currentChapterIndex}
        onJump={handleTOCJump} onClose={() => setTocOpen(false)}
      />

      <FloatButton
        className="reader-page__backtop"
        icon={<ToTopOutlined />}
        onClick={handleBackToTop}
        style={{ opacity: showBackTop ? 1 : 0, pointerEvents: showBackTop ? 'auto' : 'none', transition: 'opacity 0.3s' }}
      />
    </div>
  );
}
