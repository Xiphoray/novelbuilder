import { create } from 'zustand';
import type { ReadingSettings, AIProviderConfig } from '@/types';
import { DEFAULT_READING_SETTINGS } from '@/types';

const STORAGE_KEY_READING = 'novelbuilder_reading_settings';
const STORAGE_KEY_AI = 'novelbuilder_ai_configs';

function loadReadingSettings(): ReadingSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_READING);
    if (stored) {
      return { ...DEFAULT_READING_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    console.warn('Failed to load reading settings from localStorage');
  }
  return DEFAULT_READING_SETTINGS;
}

function saveReadingSettings(settings: ReadingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_READING, JSON.stringify(settings));
  } catch {
    console.warn('Failed to save reading settings to localStorage');
  }
}

function loadAIConfigs(): AIProviderConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_AI);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load AI configs from localStorage');
  }
  return [];
}

function saveAIConfigs(configs: AIProviderConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(configs));
  } catch {
    console.warn('Failed to save AI configs to localStorage');
  }
}

interface SettingsStore {
  /** 排版设置 */
  readingSettings: ReadingSettings;
  /** AI Provider配置列表 */
  aiConfigs: AIProviderConfig[];
  /** 当前活跃的AI配置 */
  activeAIConfig: AIProviderConfig | null;

  /** 更新排版设置 */
  updateReadingSettings: (settings: Partial<ReadingSettings>) => void;
  /** 重置排版设置 */
  resetReadingSettings: () => void;
  /** 添加AI配置 */
  addAIConfig: (config: AIProviderConfig) => void;
  /** 更新AI配置 */
  updateAIConfig: (config: AIProviderConfig) => void;
  /** 删除AI配置 */
  deleteAIConfig: (configId: string) => void;
  /** 设置活跃配置 */
  setActiveAIConfig: (configId: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  readingSettings: loadReadingSettings(),
  aiConfigs: loadAIConfigs(),
  activeAIConfig: loadAIConfigs().find((c) => c.isActive) ?? null,

  updateReadingSettings: (settings) => {
    const newSettings = { ...get().readingSettings, ...settings };
    saveReadingSettings(newSettings);
    set({ readingSettings: newSettings });
  },

  resetReadingSettings: () => {
    saveReadingSettings(DEFAULT_READING_SETTINGS);
    set({ readingSettings: DEFAULT_READING_SETTINGS });
  },

  addAIConfig: (config) => {
    const configs = [...get().aiConfigs, config];
    saveAIConfigs(configs);
    set({ aiConfigs: configs });
  },

  updateAIConfig: (config) => {
    const configs = get().aiConfigs.map((c) => (c.id === config.id ? config : c));
    saveAIConfigs(configs);
    const active = configs.find((c) => c.isActive) ?? null;
    set({ aiConfigs: configs, activeAIConfig: active });
  },

  deleteAIConfig: (configId) => {
    const configs = get().aiConfigs.filter((c) => c.id !== configId);
    saveAIConfigs(configs);
    const active = configs.find((c) => c.isActive) ?? null;
    set({ aiConfigs: configs, activeAIConfig: active });
  },

  setActiveAIConfig: (configId) => {
    const configs = get().aiConfigs.map((c) => ({
      ...c,
      isActive: c.id === configId,
    }));
    saveAIConfigs(configs);
    const active = configs.find((c) => c.isActive) ?? null;
    set({ aiConfigs: configs, activeAIConfig: active });
  },
}));
