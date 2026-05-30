import { useState, useRef } from 'react';
import { Button, List, Popconfirm, Typography, Input, Dropdown, Modal, Select, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  RobotOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ImportOutlined,
  EditOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '@/stores/bookStore';
import CreateAIDialog from '@/components/CreateAIDialog';
import { importBookFromFile } from '@/services/importService';
import { exportBookAsTxt, formatWordCount, formatRelativeTime } from '@/services/exportService';
import { db } from '@/services/db';
import type { Book } from '@/types';

const { Text } = Typography;

const ENCODING_OPTIONS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK' },
  { value: 'gb2312', label: 'GB2312' },
  { value: 'big5', label: 'BIG5' },
  { value: 'gb18030', label: 'GB18030' },
];

interface SidebarProps {
  visible: boolean;
  onToggle: () => void;
  theme?: 'light' | 'dark' | 'eye-care';
}

export default function Sidebar({ visible, onToggle, theme = 'light' }: SidebarProps) {
  const books = useBookStore((s) => s.books);
  const currentBook = useBookStore((s) => s.currentBook);
  const openBook = useBookStore((s) => s.openBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const updateBook = useBookStore((s) => s.updateBook);
  const loadBooks = useBookStore((s) => s.loadBooks);
  const loading = useBookStore((s) => s.loading);
  const navigate = useNavigate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [importing, setImporting] = useState(false);
  const [encodingModalOpen, setEncodingModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedEncoding, setSelectedEncoding] = useState<string>('utf-8');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Book | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBooks = books.filter((b) =>
    b.title.toLowerCase().includes(searchText.toLowerCase()),
  );

  /** 弹出编码选择框后重新导入 */
  const doImportWithEncoding = async (file: File, encoding?: string) => {
    try {
      const result = await importBookFromFile(file, encoding);
      message.success(`《${result.book.title}》导入成功，共 ${result.chapters.length} 章`);
      await loadBooks();
      await openBook(result.book.id);
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'ENCODING_DETECTION_FAILED') {
        setPendingFile(file);
        setSelectedEncoding('utf-8');
        setEncodingModalOpen(true);
      } else {
        const errMsg = err instanceof Error ? err.message : '导入失败';
        message.error(`${file.name}: ${errMsg}`);
      }
    }
  };

  const handleEncodingConfirm = async () => {
    if (!pendingFile) return;
    setEncodingModalOpen(false);
    const file = pendingFile;
    setPendingFile(null);
    await doImportWithEncoding(file, selectedEncoding);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        await doImportWithEncoding(file);
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /** 下载书籍 */
  const handleDownloadBook = async (book: Book) => {
    try {
      const chapters = await db.chapters
        .where('bookId')
        .equals(book.id)
        .sortBy('index');
      exportBookAsTxt(book, chapters);
    } catch {
      message.error('导出失败');
    }
  };

  /** 打开重命名弹框 */
  const handleOpenRename = (book: Book, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenameTarget(book);
    setRenameValue(book.title);
    setRenameModalOpen(true);
  };

  /** 确认重命名 */
  const handleRenameConfirm = async () => {
    if (!renameTarget) return;
    const newTitle = renameValue.trim();
    if (!newTitle) {
      message.warning('书名不能为空');
      return;
    }
    if (newTitle === renameTarget.title) {
      setRenameModalOpen(false);
      return;
    }
    try {
      await updateBook({ ...renameTarget, title: newTitle, updatedAt: Date.now() });
      message.success('重命名成功');
    } catch {
      message.error('重命名失败');
    }
    setRenameModalOpen(false);
  };

  /** 构建右键菜单 */
  const getContextMenuItems = (book: Book): MenuProps['items'] => [
    {
      key: 'open',
      icon: <FolderOpenOutlined />,
      label: '打开',
      onClick: () => openBook(book.id),
    },
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => handleOpenRename(book),
    },
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: '下载',
      onClick: () => handleDownloadBook(book),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: (info) => {
        info.domEvent.stopPropagation();
        Modal.confirm({
          title: '确定删除这本书吗？',
          content: `《${book.title}》将被永久删除，此操作不可撤销。`,
          okText: '删除',
          cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: async () => {
            try {
              await deleteBook(book.id);
              message.success('删除成功');
            } catch {
              message.error('删除失败');
            }
          },
        });
      },
    },
  ];

  return (
    <>
      <div
        className={`sidebar-theme-${theme}`}
        style={{
          width: visible ? 280 : 0,
          transition: 'width 0.2s',
          overflow: 'hidden',
          borderRight: visible ? '1px solid var(--sidebar-border, #e8e8e8)' : 'none',
          background: 'var(--sidebar-bg, #fafafa)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--sidebar-border, #e8e8e8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            📚 书库
          </Typography.Title>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
              title="设置"
            />
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={onToggle}
            />
          </div>
        </div>

        <div style={{ padding: '8px 16px' }}>
          <Input.Search
            placeholder="搜索书籍..."
            style={{
              // Override input styles are handled via CSS
            }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
          <List
            loading={loading}
            dataSource={filteredBooks}
            locale={{ emptyText: '书库为空，请导入或创建书籍' }}
            renderItem={(book) => (
              <Dropdown
                menu={{ items: getContextMenuItems(book) }}
                trigger={['contextMenu']}
              >
                <List.Item
                  key={book.id}
                  onClick={() => openBook(book.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    borderRadius: 6,
                    marginBottom: 4,
                    background: currentBook?.id === book.id ? 'var(--sidebar-active-bg, #e6f4ff)' : 'transparent',
                    border: 'none',
                  }}
                >
                  <List.Item.Meta
                    avatar={book.type === 'ai' ? <RobotOutlined /> : <BookOutlined />}
                    title={
                      <Text ellipsis style={{ maxWidth: 150 }}>
                        {book.title}
                      </Text>
                    }
                    description={
                      <div style={{ fontSize: 12 }}>
                        <Text type="secondary">
                          {book.chapterCount} 章 · {formatWordCount(book.totalWordCount)}
                        </Text>
                        {book.lastReadAt && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {formatRelativeTime(book.lastReadAt)}
                            </Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                  <Popconfirm
                    title="确定删除这本书吗？"
                    onConfirm={async (e) => {
                      e?.stopPropagation();
                      await deleteBook(book.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </List.Item>
              </Dropdown>
            )}
          />
        </div>

        <div
          style={{
            padding: '12px 16px',
          borderTop: '1px solid var(--sidebar-border, #e8e8e8)',
            display: 'flex',
            gap: 8,
          }}
        >
          <Button
            icon={<ImportOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={importing}
            style={{ flex: 1 }}
          >
            {importing ? '导入中...' : '导入书籍'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowCreateDialog(true)}
            style={{ flex: 1 }}
          >
            新建AI书
          </Button>
        </div>
      </div>

      {!visible && (
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={onToggle}
          style={{
            position: 'fixed',
            left: 8,
            top: 8,
            zIndex: 100,
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        multiple
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* 编码选择弹框 */}
      <Modal
        title="选择文件编码"
        open={encodingModalOpen}
        onOk={handleEncodingConfirm}
        onCancel={() => {
          setEncodingModalOpen(false);
          setPendingFile(null);
        }}
        okText="确认导入"
        cancelText="取消"
      >
        <p style={{ marginBottom: 8 }}>
          无法自动识别文件 "{pendingFile?.name}" 的编码，请手动选择：
        </p>
        <Select
          value={selectedEncoding}
          onChange={setSelectedEncoding}
          options={ENCODING_OPTIONS}
          style={{ width: '100%' }}
        />
      </Modal>

      {/* 重命名弹框 */}
      <Modal
        title="重命名书籍"
        open={renameModalOpen}
        onOk={handleRenameConfirm}
        onCancel={() => setRenameModalOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRenameConfirm}
          placeholder="请输入新书名"
          maxLength={100}
        />
      </Modal>

      <CreateAIDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </>
  );
}
