import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import CreateAIDialog from '@/components/CreateAIDialog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useBookStore } from '@/stores/bookStore';
import { ConfigProvider, Modal, Select, message, theme, App as AntdApp } from 'antd';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ThemeType } from '@/types';
import { importBookFromFile, extractTxtFilesFromDragEvent } from '@/services/importService';

const themeMap: Record<ThemeType, typeof theme.defaultAlgorithm> = {
  light: theme.defaultAlgorithm,
  dark: theme.darkAlgorithm,
  'eye-care': theme.defaultAlgorithm,
};

const ENCODING_OPTIONS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gbk', label: 'GBK' },
  { value: 'gb2312', label: 'GB2312' },
  { value: 'big5', label: 'BIG5' },
  { value: 'gb18030', label: 'GB18030' },
];

export default function RootLayout() {
  const navigate = useNavigate();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [createAIOpen, setCreateAIOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [encodingModalOpen, setEncodingModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedEncoding, setSelectedEncoding] = useState<string>('utf-8');
  const loadBooks = useBookStore((s) => s.loadBooks);
  const openBook = useBookStore((s) => s.openBook);
  const currentTheme = useSettingsStore((s) => s.readingSettings.theme);

  const dragCounterRef = useRef(0);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // 全局拖拽导入
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const doImportFile = useCallback(
    async (file: File, encoding?: string) => {
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
    },
    [loadBooks, openBook],
  );

  const handleEncodingConfirm = useCallback(async () => {
    if (!pendingFile) return;
    setEncodingModalOpen(false);
    const file = pendingFile;
    setPendingFile(null);
    try {
      const result = await importBookFromFile(file, selectedEncoding);
      message.success(`《${result.book.title}》导入成功，共 ${result.chapters.length} 章`);
      await loadBooks();
      await openBook(result.book.id);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '导入失败';
      message.error(`${file.name}: ${errMsg}`);
    }
  }, [pendingFile, selectedEncoding, loadBooks, openBook]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      dragCounterRef.current = 0;

      const files = extractTxtFilesFromDragEvent(e.nativeEvent);
      if (files.length === 0) {
        message.warning('请拖入 .txt 格式的文件');
        return;
      }

      for (const file of files) {
        await doImportFile(file);
      }
    },
    [doImportFile],
  );

  return (
    <AntdApp>
      <ConfigProvider
        theme={{
          algorithm: themeMap[currentTheme],
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '100vh',
            position: 'relative',
            background:
              currentTheme === 'dark'
                ? '#141414'
                : currentTheme === 'eye-care'
                  ? '#f0e6d3'
                  : '#ffffff',
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Sidebar
            visible={sidebarVisible}
            onToggle={() => setSidebarVisible(!sidebarVisible)}
            theme={currentTheme}
            onCreateAI={() => setCreateAIOpen(true)}
            onOpenHistory={() => navigate('/history')}
            onOpenSettings={() => navigate('/settings')}
          />
          <CreateAIDialog open={createAIOpen} onClose={() => setCreateAIOpen(false)} />
          <main style={{ flex: '1 1 0%', overflow: 'auto', minHeight: 0 }}>
            <Outlet />
          </main>

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

          {/* 拖拽遮罩层 */}
          {dragging && <div className="drag-overlay" />}
        </div>
      </ConfigProvider>
    </AntdApp>
  );
}
