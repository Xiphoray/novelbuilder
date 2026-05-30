/**
 * F-003: 阅读器页面
 */

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
  const { handleAppend } = useAppendGeneration(reader);
  useKeyboardNav(reader);

  const {
    currentBook, currentChapters, currentChapterIndex, readingSettings,
    tocOpen, setTocOpen, showBackTop, appendLoading, appendProgress,
    appendElapsed, canAppend, themeClass, scrollContainerRef,
    formatTime, handlePrevChapter, handleNextChapter, handleTOCJump, handleBackToTop,
  } = reader;

  const handleDownload = () => {
    if (!currentBook) return;
    exportBookAsTxt(currentBook, currentChapters);
  };

  if (!currentBook) {
    return (
      <div className={themeClass} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
        <Empty description={null} />
        <Text type="secondary" style={{ fontSize: 16 }}>📖 请从书库中选择一本书</Text>
      </div>
    );
  }

  const currentChapter = currentChapters[currentChapterIndex];

  return (
    <div ref={scrollContainerRef} className={themeClass} style={{ height: '100%', overflow: 'auto', transition: 'background-color 0.3s, color 0.3s' }}>
      <div style={{ maxWidth: readingSettings.contentWidth, margin: '0 auto', padding: '24px 48px', fontFamily: readingSettings.fontFamily, fontSize: readingSettings.fontSize, lineHeight: readingSettings.lineHeight, minHeight: '100%' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8, transition: 'color 0.3s' }}>{currentBook.title}</Title>

        <ProgressBar
          currentIndex={currentChapterIndex} totalChapters={currentChapters.length}
          onDownload={handleDownload} onTOCOpen={() => setTocOpen(true)}
        />

        <ChapterNav
          chapters={currentChapters} currentIndex={currentChapterIndex}
          onJump={handleTOCJump} contentWidth={readingSettings.contentWidth}
        />

        {currentChapter ? (
          <div>
            <Title level={4} style={{ marginBottom: 24, transition: 'color 0.3s' }}>{currentChapter.title}</Title>
            {currentChapter.content.split(/\n/).map((para, i) => (
              <Paragraph key={i} style={{ textIndent: '2em', marginBottom: '0.8em', transition: 'color 0.3s' }}>{para}</Paragraph>
            ))}
          </div>
        ) : <Empty description="章节加载失败" />}

        <AppendSection
          book={currentBook} appendLoading={appendLoading} appendProgress={appendProgress}
          appendElapsed={appendElapsed} canAppend={canAppend}
          currentChapterIndex={currentChapterIndex} totalChapters={currentChapters.length}
          formatTime={formatTime} onAppend={handleAppend}
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

      <FloatButton icon={<ToTopOutlined />} onClick={handleBackToTop}
        style={{ position: 'fixed', right: 24, bottom: 80, opacity: showBackTop ? 1 : 0, pointerEvents: showBackTop ? 'auto' : 'none', transition: 'opacity 0.3s' }}
      />
    </div>
  );
}
