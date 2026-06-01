import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Empty,
  List,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  ClearOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { db } from '@/services/db';
import type { Book, GenerationHistory } from '@/types';

const { Title, Text, Paragraph } = Typography;

type HistoryFilterType = 'all' | GenerationHistory['type'];
type HistoryFilterStatus = 'all' | 'success' | 'failed';

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function getTypeTagColor(type: GenerationHistory['type']) {
  switch (type) {
    case 'initial':
      return 'blue';
    case 'append':
      return 'purple';
    case 'summary':
      return 'gold';
    default:
      return 'default';
  }
}

function getTypeLabel(type: GenerationHistory['type']) {
  switch (type) {
    case 'initial':
      return '首次生成';
    case 'append':
      return '续写';
    case 'summary':
      return '摘要';
    default:
      return type;
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState<GenerationHistory[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<HistoryFilterType>('all');
  const [selectedStatus, setSelectedStatus] = useState<HistoryFilterStatus>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyList, bookList] = await Promise.all([
        db.generationHistory.orderBy('timestamp').reverse().toArray(),
        db.books.toArray(),
      ]);
      setHistories(historyList);
      setBooks(bookList);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '加载生成历史失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const bookTitleMap = useMemo(
    () => new Map(books.map((book) => [book.id, book.title])),
    [books],
  );

  const filteredHistories = useMemo(() => {
    return histories.filter((item) => {
      if (selectedBookId !== 'all' && item.bookId !== selectedBookId) return false;
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedStatus === 'success' && !item.success) return false;
      if (selectedStatus === 'failed' && item.success) return false;
      return true;
    });
  }, [histories, selectedBookId, selectedType, selectedStatus]);

  const stats = useMemo(() => {
    const total = filteredHistories.length;
    const successCount = filteredHistories.filter((item) => item.success).length;
    const failedCount = total - successCount;
    const totalTokens = filteredHistories.reduce((sum, item) => sum + (item.tokenUsage?.totalTokens || 0), 0);
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    const latestFailure = filteredHistories.find((item) => !item.success);
    const providerCount = new Set(filteredHistories.map((item) => item.provider)).size;

    return {
      total,
      successCount,
      failedCount,
      totalTokens,
      successRate,
      latestFailure,
      providerCount,
    };
  }, [filteredHistories]);

  const bookOptions = useMemo(
    () => [
      { value: 'all', label: `全部书籍（${books.length}）` },
      ...books.map((book) => ({ value: book.id, label: book.title })),
    ],
    [books],
  );

  const handleExport = () => {
    const now = new Date();
    const filename = `generation-history-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.json`;
    downloadJson(filename, {
      exportedAt: Date.now(),
      filters: {
        bookId: selectedBookId,
        type: selectedType,
        status: selectedStatus,
      },
      items: filteredHistories,
    });
    message.success(`已导出 ${filteredHistories.length} 条历史记录`);
  };

  const handleClear = async () => {
    try {
      await db.generationHistory.clear();
      message.success('已清空生成历史');
      await loadData();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '清空生成历史失败';
      message.error(errorMsg);
    }
  };

  return (
    <div className="history-page">
      <div className="history-page__inner">
        <div className="history-page__hero">
          <div className="history-page__hero-top">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              className="history-page__back"
            />
            <Title level={3} style={{ margin: 0 }}>📊 生成历史</Title>
          </div>
          <p className="history-page__hero-text">
            查看 AI 生成、续写与摘要调用记录，快速定位失败请求、使用量与模型调用情况。
          </p>

          <Space wrap className="history-page__toolbar">
            <Select
              value={selectedBookId}
              onChange={setSelectedBookId}
              options={bookOptions}
              style={{ minWidth: 220 }}
            />
            <Select
              value={selectedType}
              onChange={setSelectedType}
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'initial', label: '首次生成' },
                { value: 'append', label: '续写' },
                { value: 'summary', label: '摘要' },
              ]}
              style={{ minWidth: 140 }}
            />
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'success', label: '成功' },
                { value: 'failed', label: '失败' },
              ]}
              style={{ minWidth: 140 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={filteredHistories.length === 0}>
              导出 JSON
            </Button>
            <Popconfirm
              title="确认清空全部生成历史？"
              description="此操作不可恢复，但不会删除书籍和章节。"
              okText="确认清空"
              cancelText="取消"
              onConfirm={() => void handleClear()}
              disabled={histories.length === 0}
            >
              <Button danger icon={<ClearOutlined />} disabled={histories.length === 0}>
                清空历史
              </Button>
            </Popconfirm>
          </Space>
        </div>

        <Row gutter={[16, 16]} className="history-page__stats">
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="记录总数" value={stats.total} prefix={<BarChartOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="成功次数" value={stats.successCount} valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="失败次数" value={stats.failedCount} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="成功率" value={stats.successRate} suffix="%" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="总 Tokens" value={stats.totalTokens} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="history-page__card">
              <Statistic title="Provider 数" value={stats.providerCount} />
            </Card>
          </Col>
        </Row>

        {stats.latestFailure && (
          <Card className="history-page__card history-page__latest-failure" title="最近一次失败">
            <Space direction="vertical" size={4}>
              <Text strong>
                {bookTitleMap.get(stats.latestFailure.bookId) || stats.latestFailure.bookId}
              </Text>
              <Text type="secondary">
                {getTypeLabel(stats.latestFailure.type)} · {stats.latestFailure.provider} / {stats.latestFailure.model}
              </Text>
              <Text type="secondary">{formatDateTime(stats.latestFailure.timestamp)}</Text>
              <Paragraph style={{ marginBottom: 0 }}>
                {stats.latestFailure.error || '未知错误'}
              </Paragraph>
            </Space>
          </Card>
        )}

        <Card className="history-page__card" title={`历史记录（${filteredHistories.length}）`}>
          <List
            loading={loading}
            dataSource={filteredHistories}
            locale={{ emptyText: <Empty description="暂无生成历史" /> }}
            renderItem={(item) => {
              const bookTitle = bookTitleMap.get(item.bookId) || item.bookId;
              return (
                <List.Item className="history-page__list-item">
                  <div className="history-page__item">
                    <div className="history-page__item-top">
                      <Space wrap>
                        <Text strong>{bookTitle}</Text>
                        <Tag color={getTypeTagColor(item.type)}>{getTypeLabel(item.type)}</Tag>
                        <Tag color={item.success ? 'success' : 'error'}>
                          {item.success ? '成功' : '失败'}
                        </Tag>
                      </Space>
                      <Text type="secondary">{formatDateTime(item.timestamp)}</Text>
                    </div>

                    <div className="history-page__meta">
                      <Text type="secondary">Provider：{item.provider}</Text>
                      <Text type="secondary">Model：{item.model}</Text>
                      <Text type="secondary">
                        Tokens：{item.tokenUsage?.totalTokens ?? 0}
                      </Text>
                      <Text type="secondary">
                        Prompt：{item.tokenUsage?.promptTokens ?? 0}
                      </Text>
                      <Text type="secondary">
                        Completion：{item.tokenUsage?.completionTokens ?? 0}
                      </Text>
                    </div>

                    <Paragraph
                      ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                      className="history-page__prompt"
                    >
                      {item.prompt || '无提示词记录'}
                    </Paragraph>

                    {!item.success && item.error && (
                      <div className="history-page__error">
                        <Text type="danger">错误信息：{item.error}</Text>
                      </div>
                    )}
                  </div>
                </List.Item>
              );
            }}
          />
        </Card>
      </div>
    </div>
  );
}
