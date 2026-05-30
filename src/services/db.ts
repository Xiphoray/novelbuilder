import Dexie, { type EntityTable } from 'dexie';
import type { Book, Chapter, AIProviderConfig, GenerationHistory } from '@/types';

/**
 * IndexedDB 数据库实例
 * 使用 Dexie.js 封装 IndexedDB 操作
 */
const db = new Dexie('NovelBuilderDB') as Dexie & {
  books: EntityTable<Book, 'id'>;
  chapters: EntityTable<Chapter, 'id'>;
  aiConfigs: EntityTable<AIProviderConfig, 'id'>;
  generationHistory: EntityTable<GenerationHistory, 'id'>;
};

db.version(1).stores({
  books: 'id, type, createdAt, updatedAt, lastReadAt',
  chapters: 'id, bookId, index, [bookId+index]',
  aiConfigs: 'id, provider, isActive',
  generationHistory: 'id, bookId, timestamp',
});

export { db };
export default db;
