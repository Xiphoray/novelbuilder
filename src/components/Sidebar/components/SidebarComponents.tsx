/**
 * 侧边栏组件
 */

import { Typography, Input, List, Tag, Button, Select, Upload, Dropdown, Progress, Modal, Form } from 'antd';
import {
  SearchOutlined, PlusOutlined, UploadOutlined, BookOutlined,
  ClockCircleOutlined, EditOutlined, DeleteOutlined, MoreOutlined,
  DownloadOutlined, SettingOutlined,
} from '@ant-design/icons';
import type { Book } from '@/types';
import { formatWordCount, formatRelativeTime } from '@/services/exportService';

const { Title, Text } = Typography;

// ============ 头部区域 ============

interface SidebarHeaderProps {
  booksCount: number;
  importing: boolean;
  onImport: (file: File) => Promise<boolean> | boolean;
  onCreateAI: () => void;
  onOpenSettings: () => void;
}

export function SidebarHeader({ booksCount, importing, onImport, onCreateAI, onOpenSettings }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header" style={{
      padding: '20px 20px 12px', background: 'var(--sidebar-header-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%))'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, color: '#fff', fontSize: 16 }}>我的书库</Title>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{booksCount} 本</Text>
          </div>
        </div>
        <Button type="text" icon={<SettingOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />} onClick={onOpenSettings} size="small" title="设置" style={{ padding: '4px 8px' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Upload accept=".txt" showUploadList={false} beforeUpload={onImport} disabled={importing} style={{ flex: 1 }}>
          <Button size="small" icon={<UploadOutlined />} loading={importing} block style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', fontWeight: 500 }}>导入 TXT</Button>
        </Upload>
        <Button size="small" icon={<PlusOutlined />} onClick={onCreateAI} block style={{ flex: 1, background: '#fff', borderColor: '#fff', color: '#667eea', fontWeight: 600 }}>AI 创建</Button>
      </div>
    </div>
  );
}

// ============ 搜索筛选区 ============

interface SidebarFiltersProps {
  search: string; onSearchChange: (v: string) => void;
  sort: string; onSortChange: (v: any) => void;
  filter: string; onFilterChange: (v: any) => void;
}

export function SidebarFilters({ search, onSearchChange, sort, onSortChange, filter, onFilterChange }: SidebarFiltersProps) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #f0f0f0)', background: 'var(--sidebar-search-bg, #fafafa)' }}>
      <Input placeholder="搜索书名..." prefix={<SearchOutlined style={{ color: '#bbb' }} />} value={search} onChange={(e) => onSearchChange(e.target.value)} allowClear size="small" style={{ marginBottom: 8, borderRadius: 8 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <Select size="small" value={sort} onChange={onSortChange} style={{ flex: 1 }} options={[{ value: 'lastRead', label: '最近阅读' }, { value: 'recent', label: '创建时间' }, { value: 'title', label: '书名排序' }]} variant="borderless" />
        <Select size="small" value={filter} onChange={onFilterChange} style={{ flex: 1 }} options={[{ value: 'all', label: '全部' }, { value: 'import', label: '导入' }, { value: 'ai', label: 'AI' }]} variant="borderless" />
      </div>
    </div>
  );
}

// ============ 书籍列表项 ============

interface BookItemProps {
  book: Book;
  isActive: boolean;
  onSelect: (id: string) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onExport: (book: Book) => void;
}

export function BookItem({ book, isActive, onSelect, onEdit, onDelete, onExport }: BookItemProps) {
  const percent = book.chapterCount > 0 ? Math.round((((book.readingProgress?.chapterIndex ?? 0) + 1) / book.chapterCount) * 100) : 0;
  const hasRead = !!book.lastReadAt && (book.readingProgress?.chapterIndex ?? 0) > 0;

  return (
    <List.Item onClick={() => onSelect(book.id)} style={{
      cursor: 'pointer', padding: '10px 12px', marginBottom: 4, borderRadius: 8,
      background: isActive ? 'var(--sidebar-active-bg, #e6f4ff)' : 'transparent',
      border: isActive ? '1px solid #91caff' : '1px solid transparent', transition: 'all 0.2s',
    }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover-bg, #f5f5f5)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text strong style={{ fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</Text>
          <Dropdown menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: '编辑信息', onClick: () => onEdit(book) },
              { key: 'export', icon: <DownloadOutlined />, label: '导出 TXT', onClick: () => onExport(book) },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: '删除书籍', danger: true, onClick: () => onDelete(book) },
            ],
          }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} style={{ marginLeft: 4, flexShrink: 0 }} />
          </Dropdown>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Tag color={book.type === 'ai' ? 'purple' : 'blue'} style={{ margin: 0, fontSize: 11 }}>{book.type === 'ai' ? 'AI' : '导入'}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>{book.chapterCount} 章</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatWordCount(book.totalWordCount)}</Text>
        </div>
        {book.chapterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Progress percent={percent} size="small" strokeColor={percent >= 100 ? '#52c41a' : '#1677ff'} style={{ flex: 1, margin: 0 }} format={(p) => `${p}%`} />
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{hasRead ? `已读第 ${(book.readingProgress?.chapterIndex ?? 0) + 1} 章` : '未开始'}</Text>
          </div>
        )}
        {book.lastReadAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <ClockCircleOutlined style={{ fontSize: 10, color: '#999' }} />
            <Text type="secondary" style={{ fontSize: 10 }}>{formatRelativeTime(book.lastReadAt)}</Text>
          </div>
        )}
      </div>
    </List.Item>
  );
}

// ============ 编辑书籍弹窗 ============

interface EditBookModalProps {
  open: boolean;
  book: Book | null;
  form: any;
  loading: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function EditBookModal({ open, book, form, loading, onSave, onClose }: EditBookModalProps) {
  return (
    <Modal title="编辑书籍信息" open={open} onOk={onSave} onCancel={onClose} confirmLoading={loading} destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="书名" rules={[{ required: true, message: '请输入书名' }]}>
          <Input placeholder="输入书名" />
        </Form.Item>
        <div style={{ fontSize: 12, color: '#999' }}>
          <div>类型：{book?.type === 'ai' ? 'AI 生成' : '本地导入'}</div>
          <div>章节数：{book?.chapterCount ?? 0}</div>
          <div>总字数：{formatWordCount(book?.totalWordCount ?? 0)}</div>
          <div>创建时间：{book?.createdAt ? new Date(book.createdAt).toLocaleDateString() : '-'}</div>
        </div>
      </Form>
    </Modal>
  );
}
