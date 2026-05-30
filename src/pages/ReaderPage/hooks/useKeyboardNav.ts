/**
 * 键盘导航 Hook
 */

import { useEffect } from 'react';

interface KeyboardNavOptions {
  currentBook: unknown;
  currentChapters: { id: string; index: number }[];
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useKeyboardNav(options: {
  currentBook: KeyboardNavOptions['currentBook'];
  currentChapters: KeyboardNavOptions['currentChapters'];
  currentChapterIndex: KeyboardNavOptions['currentChapterIndex'];
  setCurrentChapterIndex: KeyboardNavOptions['setCurrentChapterIndex'];
  scrollContainerRef: KeyboardNavOptions['scrollContainerRef'];
}) {
  const { currentBook, currentChapters, currentChapterIndex, setCurrentChapterIndex, scrollContainerRef } = options;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentBook || currentChapters.length === 0) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      switch (e.key) {
        case 'ArrowLeft': case 'ArrowUp':
          e.preventDefault();
          if (currentChapterIndex > 0) setCurrentChapterIndex(currentChapterIndex - 1);
          break;
        case 'ArrowRight': case 'ArrowDown':
          e.preventDefault();
          if (currentChapterIndex < currentChapters.length - 1) setCurrentChapterIndex(currentChapterIndex + 1);
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
  }, [currentBook, currentChapters, currentChapterIndex, setCurrentChapterIndex, scrollContainerRef]);
}
