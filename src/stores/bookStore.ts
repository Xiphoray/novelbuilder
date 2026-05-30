import { create } from 'zustand';
import type { Book, Chapter } from '@/types';
import { db } from '@/services/db';

interface BookStore {
  /** 书籍列表 */
  books: Book[];
  /** 当前打开的书籍 */
  currentBook: Book | null;
  /** 当前书籍的章节列表 */
  currentChapters: Chapter[];
  /** 当前阅读的章节索引 */
  currentChapterIndex: number;
  /** 是否正在加载 */
  loading: boolean;

  /** 加载书籍列表 */
  loadBooks: () => Promise<void>;
  /** 打开书籍 */
  openBook: (bookId: string) => Promise<void>;
  /** 添加书籍 */
  addBook: (book: Book, chapters: Chapter[]) => Promise<void>;
  /** 删除书籍 */
  deleteBook: (bookId: string) => Promise<void>;
  /** 更新书籍 */
  updateBook: (book: Book) => Promise<void>;
  /** 追加章节 */
  appendChapters: (bookId: string, chapters: Chapter[]) => Promise<void>;
  /** 更新阅读进度 */
  updateReadingProgress: (bookId: string, chapterIndex: number, scrollOffset: number) => Promise<void>;
  /** 设置当前章节 */
  setCurrentChapterIndex: (index: number) => void;
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  currentBook: null,
  currentChapters: [],
  currentChapterIndex: 0,
  loading: false,

  loadBooks: async () => {
    try {
      set({ loading: true });
      const books = await db.books.toArray();
      console.log('[BookStore] loadBooks: found', books.length, 'books', books.map(b => b.title));
      // Sort by lastReadAt descending, falling back to updatedAt
      books.sort((a, b) => {
        const aTime = a.lastReadAt ?? a.updatedAt ?? 0;
        const bTime = b.lastReadAt ?? b.updatedAt ?? 0;
        return bTime - aTime;
      });
      set({ books });
      console.log('[BookStore] books state updated');
    } catch (error) {
      console.error('[BookStore] Failed to load books:', error);
    } finally {
      set({ loading: false });
    }
  },

  openBook: async (bookId: string) => {
    try {
      set({ loading: true });
      const book = await db.books.get(bookId);
      if (!book) {
        console.error('Book not found:', bookId);
        return;
      }
      const chapters = await db.chapters
        .where('bookId')
        .equals(bookId)
        .sortBy('index');

      set({
        currentBook: book,
        currentChapters: chapters,
        currentChapterIndex: book.readingProgress.chapterIndex,
      });
    } catch (error) {
      console.error('Failed to open book:', error);
    } finally {
      set({ loading: false });
    }
  },

  addBook: async (book: Book, chapters: Chapter[]) => {
    try {
      await db.transaction('rw', [db.books, db.chapters], async () => {
        // 获取所有书籍检查是否已存在同名书籍（title 字段未索引，使用 toArray）
        const allBooks = await db.books.toArray();
        const existing = allBooks.find(b => b.title === book.title);
        if (existing) {
          // 如果存在同名书籍，使用 put 而不是 add（会覆盖或更新）
          await db.books.put(book);
          // 删除旧章节
          await db.chapters.where('bookId').equals(existing.id).delete();
        } else {
          await db.books.add(book);
        }
        await db.chapters.bulkAdd(chapters);
      });
      // 重新加载列表
      await get().loadBooks();
    } catch (error) {
      console.error('Failed to add book:', error);
      throw error;
    }
  },

  deleteBook: async (bookId: string) => {
    try {
      // 先删除关联数据，再删除书籍
      await db.chapters.where('bookId').equals(bookId).delete();
      await db.generationHistory.where('bookId').equals(bookId).delete();
      await db.books.delete(bookId);

      const { currentBook } = get();
      if (currentBook?.id === bookId) {
        set({ currentBook: null, currentChapters: [], currentChapterIndex: 0 });
      }
      await get().loadBooks();
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw error;
    }
  },

  updateBook: async (book: Book) => {
    try {
      await db.books.put(book);
      const { currentBook } = get();
      if (currentBook?.id === book.id) {
        set({ currentBook: book });
      }
      await get().loadBooks();
    } catch (error) {
      console.error('Failed to update book:', error);
      throw error;
    }
  },

  appendChapters: async (bookId: string, chapters: Chapter[]) => {
    try {
      await db.transaction('rw', [db.books, db.chapters], async () => {
        await db.chapters.bulkAdd(chapters);
        const book = await db.books.get(bookId);
        if (book) {
          const totalChapters = await db.chapters.where('bookId').equals(bookId).count();
          const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, book.totalWordCount);
          await db.books.update(bookId, {
            chapterCount: totalChapters,
            totalWordCount: totalWords,
            updatedAt: Date.now(),
          });
        }
      });
      const { currentBook } = get();
      if (currentBook?.id === bookId) {
        await get().openBook(bookId);
      }
    } catch (error) {
      console.error('Failed to append chapters:', error);
      throw error;
    }
  },

  updateReadingProgress: async (bookId: string, chapterIndex: number, scrollOffset: number) => {
    try {
      const progress = { chapterIndex, scrollOffset };
      await db.books.update(bookId, {
        readingProgress: progress,
        lastReadAt: Date.now(),
      });
      const { currentBook } = get();
      if (currentBook?.id === bookId) {
        set({
          currentBook: { ...currentBook, readingProgress: progress, lastReadAt: Date.now() },
          currentChapterIndex: chapterIndex,
        });
      }
    } catch (error) {
      console.error('Failed to update reading progress:', error);
    }
  },

  setCurrentChapterIndex: (index: number) => {
    set({ currentChapterIndex: index });
  },
}));
