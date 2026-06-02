<div align="center">

# ✨ Novel Builder

**AI 驱动的即时小说生成与阅读器**

*边读边写，让 AI 成为你的创作搭档*

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5-0170FE?logo=antd)](https://ant.design/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [技术栈](#-技术栈) · [项目结构](#-项目结构) · [开发指南](#-开发指南)

---

</div>

## 📖 项目简介

Novel Builder 是一款 Web 端 AI 小说即时生成阅读器。它支持：

- 🤖 **AI 即时创作**：选择风格，一键生成 2 章小说，边读边追加
- 📚 **本地书库管理**：导入 TXT 文件，自动识别编码与章节
- 🎨 **沉浸式阅读**：多种主题、字体、排版参数可调
- 🔌 **多 Provider 支持**：OpenAI / Anthropic / 兼容 API 无缝切换

## 🆕 近期变更（v2.7 / 2026-06-02）

- 📲 **F-013 PWA 支持闭环**：补齐 `manifest.webmanifest`（含名称、lang、主题色、5 个图标）、Service Worker（静态按 hash 缓存 + 导航走 Network First 并跳 `/api/` 与 HMR）、iOS 专用 meta 与 `apple-touch-icon`，`main.tsx` 在 `import.meta.env.PROD` 下才注册 SW 避免开发期拦截
- 🔄 **SW 检查更新机制**：每 60 分钟调用 `reg.update()`，发现新版本后在 console 提示「新版本已就绪，刷新页面以启用」

## 🆕 近期变更（v2.6 / 2026-06-02）

- 🧹 **清理调试预览**：拿掉 AI 生成 / 续写阶段页面顶部的“中途内容预览”模块，进程仅保留进度提示与状态描述
- 🖱️ **侧边栏装饰圆斑点击穿透修复**：`.sidebar-header::after` 补上 `pointer-events: none`，装饰视觉效果不变，下方控件点击事件不再被拦截
- 🔄 **追加生成触发逻辑调整**：从“滚动到最后一章 80%”改为“打开最后一章即自动续写”
- 📊 **生成历史页完善**：补齐首次/续写后摘要成功与失败的历史记录，支持按书籍/类型/状态筛选与 JSON 导出

## 🚀 功能特性

### 阅读体验

| 功能 | 说明 |
|------|------|
| 📖 沉浸式阅读 | 单列长滚动模式，支持键盘/鼠标翻页 |
| 📑 章节目录 | Drawer 抽屉式目录面板，一键跳转 |
| ⬆️ 回到顶部 | 浮动按钮，滚动超过 200px 自动出现 |
| 📊 阅读进度 | 自动记录并恢复阅读位置 |
| ⬇️ 书籍导出 | TXT 格式一键下载 |

### 书库管理

| 功能 | 说明 |
|------|------|
| 📁 侧边栏书库 | 按最后阅读时间排序，显示进度百分比 |
| 🔍 书名搜索 | 实时模糊匹配，快速定位 |
| 📥 文件导入 | 拖拽或选择导入 TXT，自动识别编码 |
| 📝 章节分割 | 自动识别中文章节标题（第X章/节/回） |
| 🖱️ 右键菜单 | 打开、重命名、下载、删除 |

### 排版设置

| 功能 | 说明 |
|------|------|
| 🔤 字号调整 | 14px ~ 32px 滑块调节 |
| 📏 行距调整 | 1.2 ~ 2.5 精细控制 |
| 🎯 字体选择 | 系统默认、宋体、楷体、等宽 |
| 🌓 主题切换 | 亮色 / 暗色 / 护眼 三种主题 |
| 📐 内容宽度 | 600px ~ 1200px 自适应 |
| ⚡ 快速预设 | 默认/舒适/夜间/紧凑 四种方案一键切换 |

### AI 生成

| 功能 | 说明 |
|------|------|
| 🎭 风格选择 | 玄幻、仙侠、都市、科幻等 11 种风格 |
| 📝 AI 生成 | 首次生成 2 章小说内容，支持流式生成反馈 |
| 🔄 追加生成 | 打开最后一章即自动续写 2 章，也可手动触发 |
| 🔌 多 Provider | OpenAI / Anthropic / OpenAI Compatible |

### 存储管理

| 功能 | 说明 |
|------|------|
| 💾 IndexedDB | 大容量本地存储，支持 50MB+ 小说 |
| 📊 存储监控 | 实时显示已用/可用空间 |
| 🧹 数据清理 | 一键清理残留章节和历史数据 |

## 🛠️ 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 方式一：一键启动（推荐）

项目提供了启动脚本，可同时启动前后端服务：

**Windows 用户：**
```bash
# 双击运行
start.bat

# 或在命令行中运行
.\start.bat
```

**macOS / Linux 用户：**
```bash
# 添加执行权限（首次运行）
chmod +x start.sh

# 运行脚本
./start.sh
```

脚本会自动完成：
1. 检查 Node.js 环境
2. 安装缺失的依赖
3. 启动后端服务（端口 5299）
4. 启动前端开发服务器（端口 5298）

### 方式二：手动启动

```bash
# 克隆项目
git clone https://github.com/Xiphoray/novelbuilder.git
cd novelbuilder

# 安装依赖
npm install

# 启动后端服务（新终端窗口）
npm run server

# 启动前端开发服务器（另一个终端窗口）
npm run dev
```

### 构建与预览

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

启动后访问 [http://localhost:5298](http://localhost:5298) 🎉

### 配置 AI Provider

1. 打开设置页面 `#/settings`
2. 选择 Provider 类型（OpenAI / Anthropic / OpenAI Compatible）
3. 填写 API Base URL、API Key、模型 ID
4. 点击「测试连接」验证配置
5. 点击「添加配置」保存

> 🔐 **安全说明**：API Key 在后端使用 **AES-256-GCM** 加密保存到 `server/config.json`
> 的 `encryptedKeys` 字段；主密钥在首次启动时随机生成到 `server/.master.key`（与
> `server/config.json` 一样在 `.gitignore` 中）。**请勿将 `.master.key` 提交到仓库
> 或上传到云端**，否则密文可被解密。如需更换主密钥，删除 `.master.key` 后重启即可，
> 已有密文将无法恢复（需重新填写 apiKey）。

**内置 AI 服务（示例）：**

| Provider | Base URL | 模型 |
|----------|----------|------|
| Example | `https://api.example.com/v1` | mimo-v2.5 |
| OpenAI | `https://api.openai.com/v1` | gpt-4o |

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [React](https://react.dev/) | 19 | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 6 | 类型安全 |
| [Vite](https://vitejs.dev/) | 8 | 构建工具 |
| [Ant Design](https://ant.design/) | 5.29 | UI 组件库 |
| [Zustand](https://github.com/pmndrs/zustand) | 5 | 状态管理 |
| [Dexie.js](https://dexie.org/) | 4.4 | IndexedDB 封装 |
| [uuid](https://github.com/uuidjs/uuid) | 11 | 唯一 ID 生成 |
| [React Router](https://reactrouter.com/) | 7 | 路由 |
| [jschardet](https://github.com/aadsm/jschardet) | 3.1 | 编码检测 |
| [Express](https://expressjs.com/) | 5 | 后端 API 服务 |

## 📁 项目结构

```
novelbuilder/
├── public/                      # 静态资源
│   ├── favicon.svg
│   └── icons.svg
├── server/                      # Express 后端服务
│   ├── index.js                 # 入口文件（中间件、路由注册）
│   ├── config.json              # AI 配置存储（apiKey 已加密为密文）
│   ├── .master.key              # 本地主密钥（首次启动自动生成，已被 .gitignore）
│   ├── logs/                    # 运行日志
│   ├── routes/                  # API 路由
│   │   ├── config.js            # 配置管理路由（CRUD、测试连接）
│   │   └── generate.js          # AI 生成路由（首次/追加/摘要/SSE）
│   └── utils/                   # 后端工具模块
│       ├── aiClient.js          # AI API 客户端（OpenAI/Anthropic 适配）
│       ├── configStore.js       # 配置存储管理
│       ├── cryptoStore.js       # AES-256-GCM 加密层（保护 apiKey）
│       ├── contentParser.js     # 小说内容解析
│       ├── helpers.js           # 工具函数（中文数字转换）
│       └── logger.js            # 日志系统
├── src/
│   ├── assets/                  # 图片资源
│   ├── components/
│   │   ├── CreateAIDialog/      # AI 书籍创建对话框
│   │   │   ├── index.tsx        # 主组件
│   │   │   ├── GenerateProgress.tsx  # 生成进度组件
│   │   │   └── useGenerateNovel.ts   # 生成逻辑 Hook
│   │   └── Sidebar/             # 侧边栏书库组件
│   │       ├── index.tsx        # 主组件
│   │       ├── components/      # 子组件
│   │       └── hooks/           # 自定义 Hooks
│   ├── layouts/
│   │   └── RootLayout.tsx       # 根布局（侧边栏 + 阅读区）
│   ├── pages/
│   │   ├── ReaderPage/          # 📖 阅读器模块
│   │   │   ├── index.tsx        # 主页面
│   │   │   ├── components/      # 阅读器子组件
│   │   │   └── hooks/           # 阅读器 Hooks
│   │   └── SettingsPage/        # ⚙️ 设置模块
│   │       ├── index.tsx        # 主页面
│   │       ├── components/      # 设置页子组件
│   │       └── hooks/           # 设置页 Hooks
│   ├── routes/
│   │   └── index.tsx            # 路由配置
│   ├── services/
│   │   ├── db.ts                # IndexedDB 数据库（Dexie.js）
│   │   ├── aiClient.ts          # 前端 AI API 客户端
│   │   ├── aiConfig.ts          # AI 配置管理
│   │   ├── aiGenerate.ts        # AI 生成服务
│   │   ├── aiStream.ts          # SSE 流式处理
│   │   ├── aiTypes.ts           # AI 类型定义
│   │   ├── aiService.ts         # AI 服务（兼容层）
│   │   ├── backupExport.ts      # 备份导出
│   │   ├── backupImport.ts      # 备份导入
│   │   ├── backupRestore.ts     # 备份恢复
│   │   ├── backupService.ts     # 备份服务
│   │   ├── backupTypes.ts       # 备份类型定义
│   │   ├── backupUtils.ts       # 备份工具
│   │   ├── exportService.ts     # 书籍导出
│   │   ├── importEncoding.ts    # 编码检测
│   │   ├── importService.ts     # 文件导入
│   │   ├── importSplitter.ts    # 章节分割
│   │   └── importTypes.ts       # 导入类型定义
│   ├── stores/
│   │   ├── bookStore.ts         # 书籍状态管理
│   │   └── settingsStore.ts     # 设置状态管理
│   ├── styles/
│   │   └── global.css           # 全局样式 + 主题
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── App.tsx                  # 应用入口
│   ├── main.tsx                 # Vite 入口
│   └── vite-env.d.ts            # Vite 类型声明
├── start.bat                    # Windows 一键启动脚本
├── start.sh                     # macOS/Linux 一键启动脚本
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite 配置（含 AI API 代理）
└── requirement.md               # 产品需求文档
```

## 🧩 核心模块

### 数据流

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   ReaderPage │────▶│   bookStore  │────▶│  IndexedDB   │
│   (阅读器)   │     │  (Zustand)   │     │  (Dexie.js)  │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐     ┌──────────────┐
                     │ SettingsPage │────▶│ settingsStore│
                     │   (设置页)   │     │ (LocalStorage)│
                     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐     ┌──────────────┐
                     │ Express 后端 │────▶│  AI Provider │
                     │  (API 代理)  │     │ (OpenAI等)   │
                     └──────────────┘     └──────────────┘
```

### AI 代理架构

开发环境下，Vite 代理解决 CORS 跨域问题：

```
浏览器 ──▶ /api/* ──▶ Vite Proxy ──▶ http://localhost:5299/api/*
```

生产环境下，构建后的静态文件由 Express 托管，请求直接由后端处理：

```
浏览器 ──▶ /api/* ──▶ Express 后端 ──▶ AI Provider API
```

## 📋 开发指南

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务器 |
| `npm run server` | 启动后端 API 服务 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `start.bat` / `./start.sh` | 一键启动前后端服务 |

### 开发规范

- **组件**：React 函数组件 + Hooks
- **状态**：Zustand store，避免 prop drilling
- **样式**：Ant Design 组件 + 全局 CSS 变量主题
- **类型**：严格 TypeScript，所有接口在 `types/index.ts` 定义
- **路由**：React Router v7，hash 模式

### 主题系统

通过 CSS 变量实现三种主题切换：

| 主题 | 背景色 | 文字色 | 适用场景 |
|------|--------|--------|----------|
| `light` | `#FFFFFF` | `#333333` | 日间阅读 |
| `dark` | `#1F1F1F` | `#E0E0E0` | 夜间阅读 |
| `eye-care` | `#F7F0E6` | `#5B4636` | 护眼模式 |

## 🧪 构建状态

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `tsc -b`（TypeScript 项目引用构建） | ✅ 零错误 | |
| `vite build`（生产构建） | ✅ 1.20s | 产物：index.html(2.20 kB) + manifest.webmanifest(1.82 kB) + sw.js(3.82 kB) + CSS(16.85 kB / gzip 3.31 kB) + 11 个 JS chunk + 5 个 SVG 图标 |
| Chunk 拆分 | ✅ 已拆包 | 5 个 vendor + 3 个页面 chunk，antd / react / dexie / utils 均独立拆包 |

## 📊 功能完成度

| 模块 | 完成度 | 状态 |
|------|--------|------|
| 阅读器核心 | 100% | ✅ |
| 侧边栏书库 | 100% | ✅ |
| 排版设置 | 100% | ✅ |
| 本地导入 | 100% | ✅ |
| 数据持久化 | 100% | ✅ |
| 书籍导出 | 100% | ✅ |
| AI API 配置 | 100% | ✅ |
| AI 书籍生成 | 100% | ✅ 已完成联调验收 |
| 追加生成 | 100% | ✅ 已完成联调验收 |
| 数据备份恢复（F-012） | 100% | ✅ `services/backup*` 六模块闭环 |
| PWA 支持（F-013） | 100% | ✅ manifest + Service Worker + 5 个图标 + iOS meta，生产环境注册 |
| 移动端响应式 | 🚧 进行中 | 生成历史页已适配；阅读区/侧边栏/设置页小屏需补齐 |
| **整体进度** | **95%** | 🚧 |

## 🤝 参与贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 License

[MIT](LICENSE)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！⭐**

</div>
