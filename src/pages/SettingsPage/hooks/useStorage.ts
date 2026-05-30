/**
 * 存储管理 Hook
 */

import { useState, useEffect } from 'react';
import { App } from 'antd';
import { db } from '@/services/db';

export function useStorage() {
  const { message } = App.useApp();
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          setStorageUsage(est.usage || 0);
          setStorageAvailable(est.quota || 0);
          setStorageError(null);
        } else {
          setStorageError('浏览器不支持存储估算 API');
        }
      } catch (err) {
        setStorageError(err instanceof Error ? err.message : '获取存储信息失败');
      }
    };
    load();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleCleanup = async () => {
    setClearing(true);
    try {
      const books = await db.books.toArray();
      const bookIds = new Set(books.map((b) => b.id));

      let deletedChapters = 0;
      const orphanChapters = await db.chapters.filter((ch) => !bookIds.has(ch.bookId)).toArray();
      deletedChapters = orphanChapters.length;
      if (deletedChapters > 0) await db.chapters.bulkDelete(orphanChapters.map((c) => c.id));

      let deletedHistory = 0;
      const orphanHistory = await db.generationHistory.filter((h) => !bookIds.has(h.bookId)).toArray();
      deletedHistory = orphanHistory.length;
      if (deletedHistory > 0) await db.generationHistory.bulkDelete(orphanHistory.map((h) => h.id));

      message.success(`清理完成：删除 ${deletedChapters} 个残留章节，${deletedHistory} 条残留生成历史`);

      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        setStorageUsage(est.usage || 0);
        setStorageAvailable(est.quota || 1);
      }
    } catch {
      message.error('清理失败');
    } finally {
      setClearing(false);
    }
  };

  const percent = storageAvailable > 0 ? Math.min(Math.round((storageUsage / storageAvailable) * 100), 100) : 0;

  return {
    storageUsage, storageAvailable, storageError, clearing,
    formatBytes, percent, handleCleanup,
  };
}
