/**
 * F-012: 数据备份恢复服务
 * 支持将书库数据导出为 JSON 备份文件，并可从备份恢复
 */

export { exportBackup, downloadBackup } from './backupExport';
export { readBackupFile, validateBackup } from './backupImport';
export { restoreBackup } from './backupRestore';
export { getBackupPreview, formatWordCount } from './backupUtils';
export { BACKUP_VERSION } from './backupTypes';
export type { BackupData, ConflictStrategy, RestoreResult, BackupPreview } from './backupTypes';
