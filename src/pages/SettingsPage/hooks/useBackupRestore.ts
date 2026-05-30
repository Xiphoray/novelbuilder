/**
 * 备份恢复 Hook
 */

import { useState, useRef } from 'react';
import { App } from 'antd';
import { downloadBackup, readBackupFile, restoreBackup, getBackupPreview } from '@/services/backupService';
import type { BackupData, ConflictStrategy, RestoreResult } from '@/services/backupService';

export function useBackupRestore() {
  const { message } = App.useApp();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [backupPreview, setBackupPreview] = useState<ReturnType<typeof getBackupPreview> | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('skip');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBackingUp(true);
    try {
      await downloadBackup();
      message.success('备份文件已下载');
    } catch {
      message.error('备份失败');
    } finally {
      setBackingUp(false);
    }
  };

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      setBackupPreview(getBackupPreview(data));
      setBackupData(data);
      setRestoreModalOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '备份文件读取失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!backupData) return;
    setRestoring(true);
    try {
      const result: RestoreResult = await restoreBackup(backupData, conflictStrategy);
      const parts: string[] = [];
      if (result.booksImported > 0) parts.push(`导入 ${result.booksImported} 本书`);
      if (result.booksSkipped > 0) parts.push(`跳过 ${result.booksSkipped} 本书`);
      if (result.chaptersImported > 0) parts.push(`${result.chaptersImported} 个章节`);
      if (result.historyImported > 0) parts.push(`${result.historyImported} 条历史`);
      message.success(`恢复完成：${parts.join('，')}`);
      setRestoreModalOpen(false);
      setBackupPreview(null);
      setBackupData(null);
    } catch {
      message.error('恢复失败');
    } finally {
      setRestoring(false);
    }
  };

  const handleCloseRestoreModal = () => {
    setRestoreModalOpen(false);
    setBackupPreview(null);
    setBackupData(null);
  };

  return {
    backingUp, restoring, restoreModalOpen, backupPreview, backupData,
    conflictStrategy, setConflictStrategy, fileInputRef,
    handleExport, handleSelectFile, handleConfirmRestore, handleCloseRestoreModal,
  };
}
