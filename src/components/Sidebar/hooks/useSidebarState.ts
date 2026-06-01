/**
 * 侧边栏状态 Hook
 */

import { useState, useMemo } from 'react';
import type { Book } from '@/types';

export type SortOption = 'lastRead' | 'title' | 'recent';
export type FilterOption = 'all' | 'import' | 'ai';

export function useSidebarState(books: Book[]) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('lastRead');
  const [filter, setFilter] = useState<FilterOption>('all');

  const filteredBooks = useMemo(() => {
    let result = books;
    if (filter !== 'all') result = result.filter((b) => b.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q));
    }
    return result;
  }, [books, search, filter]);

  const sortedBooks = useMemo(() => {
    const arr = [...filteredBooks];
    switch (sort) {
      case 'lastRead': arr.sort((a, b) => (b.lastReadAt ?? b.updatedAt ?? 0) - (a.lastReadAt ?? a.updatedAt ?? 0)); break;
      case 'title': arr.sort((a, b) => a.title.localeCompare(b.title, 'zh')); break;
      case 'recent': arr.sort((a, b) => b.createdAt - a.createdAt); break;
    }
    return arr;
  }, [filteredBooks, sort]);

  return { search, setSearch, sort, setSort, filter, setFilter, sortedBooks };
}
