/**
 * 阅读器状态 Hook
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function useReaderState() {
  const currentBook = useBookStore((s) => s.currentBook);
  const currentChapters = useBookStore((s) => s.currentChapters);
  const currentChapterIndex = useBookStore((s) => s.currentChapterIndex);
  const setCurrentChapterIndex = useBookStore((s) => s.setCurrentChapterIndex);
  const updateReadingProgress = useBookStore((s) => s.updateReadingProgress);
  const readingSettings = useSettingsStore((s) => s.readingSettings);

  const [tocOpen, setTocOpen] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [appendLoading, setAppendLoading] = useState(false);
  const [appendProgress, setAppendProgress] = useState('');
  const [appendElapsed, setAppendElapsed] = useState(0);
  const [canAppend, setCanAppend] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        updateReadingProgress(currentBook.id, currentChapterIndex, container.scrollTop);
      }
    }, 500);
  }, [currentBook, currentChapterIndex, updateReadingProgress]);

  // 监听滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      saveScrollPosition();
      setShowBackTop(container.scrollTop > 200);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [saveScrollPosition]);

  // 切换章节时恢复滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isRestoringRef.current = true;
    const savedOffset = currentBook?.readingProgress?.scrollOffset ?? 0;
    const savedChapter = currentBook?.readingProgress?.chapterIndex ?? 0;
    if (savedChapter === currentChapterIndex && savedOffset > 0) {
      requestAnimationFrame(() => { container.scrollTop = savedOffset; isRestoringRef.current = false; });
    } else {
      container.scrollTop = 0;
      isRestoringRef.current = false;
    }
  }, [currentChapterIndex, currentBook]);

  // 追加生成计时器
  useEffect(() => {
    if (!appendLoading) return;
    setAppendElapsed(0);
    const timer = setInterval(() => setAppendElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [appendLoading]);

  // 滚动检测追加生成
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !currentBook || currentBook.type !== 'ai') return;
    const handleScroll = () => {
      const isLastChapter = currentChapterIndex >= currentChapters.length - 1;
      if (!isLastChapter || appendLoading) { setCanAppend(false); return; }
      const scrollPercent = container.scrollTop / (container.scrollHeight - container.clientHeight);
      setCanAppend(scrollPercent > 0.6);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentChapterIndex, currentChapters.length, currentBook, appendLoading]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) setCurrentChapterIndex(currentChapterIndex - 1);
  }, [currentChapterIndex, setCurrentChapterIndex]);

  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < currentChapters.length - 1) setCurrentChapterIndex(currentChapterIndex + 1);
  }, [currentChapterIndex, currentChapters.length, setCurrentChapterIndex]);

  const handleTOCJump = useCallback((index: number) => {
    setCurrentChapterIndex(index);
    setTocOpen(false);
  }, [setCurrentChapterIndex]);

  const handleBackToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return {
    currentBook, currentChapters, currentChapterIndex, readingSettings,
    tocOpen, setTocOpen, showBackTop, appendLoading, appendProgress,
    appendElapsed, canAppend, themeClass, scrollContainerRef,
    formatTime, handlePrevChapter, handleNextChapter, handleTOCJump, handleBackToTop,
    setAppendLoading, setAppendProgress, setCanAppend,
    setCurrentChapterIndex,
  };
}
