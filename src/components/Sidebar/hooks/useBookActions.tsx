/**
 * 侧边栏书籍操作 Hook
 */

import { useState } from 'react';
import { App, Form, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { Book } from '@/types';
import { useBookStore } from '@/stores/bookStore';
import { importBookFromFile } from '@/services/importService';
import { exportBookAsTxt } from '@/services/exportService';
import { db } from '@/services/db';

export function useBookActions() {
  const { message } = App.useApp();
  const openBook = useBookStore((s) => s.openBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const updateBook = useBookStore((s) => s.updateBook);

  const [importing, setImporting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  const handleImportTxt = async (file: File) => {
    setImporting(true);
    try {
      const { book, chapters } = await importBookFromFile(file);
      const { addBook } = useBookStore.getState();
      await addBook(book, chapters);
      message.success(`导入成功：${book.title}（${chapters.length} 章）`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
    return false;
  };

  const handleSelectBook = async (bookId: string) => {
    await openBook(bookId);
  };

  const handleOpenEdit = (book: Book) => {
    setEditingBook(book);
    editForm.setFieldsValue({ title: book.title });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBook) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateBook({ ...editingBook, title: values.title.trim(), updatedAt: Date.now() });
      message.success('书籍信息已更新');
      setEditModalOpen(false);
      setEditingBook(null);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string, bookTitle: string) => {
    try {
      await deleteBook(bookId);
      message.success(`已删除：${bookTitle}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const confirmDelete = (book: Book) => {
    Modal.confirm({
      title: '确认删除', icon: <ExclamationCircleOutlined />,
      content: `确定要删除《${book.title}》吗？此操作不可撤销。`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: () => handleDeleteBook(book.id, book.title),
    });
  };

  const handleExportBook = async (book: Book) => {
    try {
      const chapters = await db.chapters.where('bookId').equals(book.id).sortBy('index');
      if (chapters.length === 0) { message.warning('该书籍没有章节，无法导出'); return; }
      exportBookAsTxt(book, chapters);
      message.success(`已导出：${book.title}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败');
    }
  };

  return {
    importing, editModalOpen, editingBook, editForm, editLoading,
    handleImportTxt, handleSelectBook, handleOpenEdit, handleSaveEdit,
    handleDeleteBook, confirmDelete, handleExportBook,
    setEditModalOpen, setEditingBook,
  };
}
