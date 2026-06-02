/**
 * F-002: 侧边栏 - 书库列表
 */

import { Button } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { Book } from '@/types';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSidebarState } from './hooks/useSidebarState';
import { useBookActions } from './hooks/useBookActions';
import { SidebarHeader, SidebarFilters, BookItem, EditBookModal } from './components/SidebarComponents';

interface SidebarProps {
  visible: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark' | 'eye-care';
  onCreateAI: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export default function Sidebar({ visible, onToggle, theme, onCreateAI, onOpenHistory, onOpenSettings }: SidebarProps) {
  const books = useBookStore((s) => s.books);
  const currentBook = useBookStore((s) => s.currentBook);
  const storeTheme = useSettingsStore((s) => s.readingSettings.theme);
  const activeTheme = theme || storeTheme;
  const isMobile = useIsMobile();
  // 仅在移动端浮动模式下才需要遮罩；桌面端侧边栏是常驻区域，遮罩会拦截所有点击
  const showOverlay = isMobile;

  const { search, setSearch, sort, setSort, filter, setFilter, sortedBooks } = useSidebarState(books);
  const { importing, editModalOpen, editingBook, editForm, editLoading, handleImportTxt, handleSelectBook, handleOpenEdit, handleSaveEdit, confirmDelete, handleExportBook, setEditModalOpen, setEditingBook } = useBookActions();

  const sidebarThemeClass = activeTheme === 'dark' ? 'sidebar-theme-dark' : activeTheme === 'eye-care' ? 'sidebar-theme-eye-care' : '';

  return (
    <>
      {!visible && (
        <Button type="text" className={`sidebar-toggle-btn ${activeTheme === 'dark' ? 'dark-theme' : ''}`} icon={<BookOutlined />} onClick={onToggle} title="打开书库" />
      )}
      {visible && showOverlay && <div onClick={onToggle} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000 }} />}

      <div className={`sidebar-panel ${sidebarThemeClass}`} style={{
        width: visible ? 320 : 0, minWidth: visible ? 320 : 0, height: '100%',
        display: 'flex', flexDirection: 'column', borderRight: visible ? '1px solid var(--border-color, #e8e8e8)' : 'none',
        background: 'var(--sidebar-bg, #fff)', overflow: 'hidden', transition: 'width 0.25s ease, min-width 0.25s ease',
        position: 'relative', zIndex: 1001,
      }}>
        <Button type="text" size="small" icon={<span style={{ fontSize: 16 }}>‹</span>} onClick={onToggle} style={{ position: 'absolute', right: 4, top: 12, zIndex: 10, opacity: 0.5 }} title="收起书库" />

        <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease', pointerEvents: visible ? 'auto' : 'none' }}>
          <SidebarHeader booksCount={books.length} importing={importing} onImport={handleImportTxt} onCreateAI={onCreateAI} onOpenHistory={onOpenHistory} onOpenSettings={onOpenSettings} />
          <SidebarFilters search={search} onSearchChange={setSearch} sort={sort} onSortChange={setSort} filter={filter} onFilterChange={setFilter} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px', opacity: visible ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: visible ? 'auto' : 'none' }}>
          {sortedBooks.map((book: Book) => (
            <BookItem key={book.id} book={book} isActive={currentBook?.id === book.id} onSelect={handleSelectBook} onEdit={handleOpenEdit} onDelete={confirmDelete} onExport={handleExportBook} />
          ))}
          {sortedBooks.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无书籍</div>}
        </div>

        <EditBookModal open={editModalOpen} book={editingBook} form={editForm} loading={editLoading} onSave={handleSaveEdit} onClose={() => { setEditModalOpen(false); setEditingBook(null); }} />
      </div>
    </>
  );
}
