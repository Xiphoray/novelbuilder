<div align="center">

# ✨ Novel Builder

**AI 驱动的即时小说生成与阅读器** · **边读边写，让 AI 成为你的创作搭档**

<p>
  <a href="https://github.com/Xiphoray/novelbuilder/stargazers">
    <img src="https://img.shields.io/github/stars/Xiphoray/novelbuilder?style=for-the-badge&logo=github&color=FFD700" alt="Stars"/>
  </a>
  <a href="https://github.com/Xiphoray/novelbuilder/network/members">
    <img src="https://img.shields.io/github/forks/Xiphoray/novelbuilder?style=for-the-badge&logo=github&color=8B5CF6" alt="Forks"/>
  </a>
  <a href="https://github.com/Xiphoray/novelbuilder/issues">
    <img src="https://img.shields.io/github/issues/Xiphoray/novelbuilder?style=for-the-badge&logo=github&color=FF6B6B" alt="Issues"/>
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/Xiphoray/novelbuilder?style=for-the-badge&color=22C55E" alt="License"/>
  </a>
</p>

<p>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19"/></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6"/></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8"/></a>
  <a href="https://ant.design/"><img src="https://img.shields.io/badge/Ant%20Design-5-0170FE?style=flat-square&logo=antdesign&logoColor=white" alt="Ant Design 5"/></a>
  <a href="https://github.com/pmndrs/zustand"><img src="https://img.shields.io/badge/Zustand-5-FF6B35?style=flat-square&logo=zustand&logoColor=white" alt="Zustand 5"/></a>
  <a href="https://dexie.org/"><img src="https://img.shields.io/badge/Dexie-4-7C3AED?style=flat-square&logo=sqlite&logoColor=white" alt="Dexie 4"/></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" alt="Express 5"/></a>
</p>

<p>
  <a href="#-演示截图">演示截图</a> ·
  <a href="#-核心特性">核心特性</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-技术栈">技术栈</a> ·
  <a href="#-项目结构">项目结构</a> ·
  <a href="#-roadmap">Roadmap</a> ·
  <a href="#-贡献">贡献</a>
</p>

</div>

---

## 🎯 这是什么？

**Novel Builder** 是一款 Web 端 **AI 小说即时生成阅读器**，它把"阅读"和"创作"无缝融合在一起：

- 🤖 **不想看套路文？** 选择风格（玄幻/仙侠/都市/科幻…），AI 现场给你写 2 章
- 📚 **手头有 TXT 小说？** 拖进来自动识别编码 + 切章节，秒变可阅读可续写的"半成品"
- 🎨 **阅读体验差？** 字号/行距/字体/主题/宽度全可调，亮色/暗色/护眼三套主题
- 🔌 **API 不会写？** 兼容 OpenAI / Anthropic / 自定义兼容 API，UI 里点几下就能用

> 💡 **核心理念**：让 AI 成为你的"创作搭档"——读不下去就让 AI 续写，AI 写歪了你就直接编辑，作者 + AI 共创一部作品。

---

## 📸 演示截图

> 截图占位 — 部署后可补充

| 阅读器（护眼主题） | AI 风格选择 | 设置页 |
|:---:|:---:|:---:|
| `[screenshot-reader]` | `[screenshot-ai-dialog]` | `[screenshot-settings]` |

---

## ⚡ 快速开始

### 一行启动（推荐）

```bash
# Windows
双击 start.bat

# macOS / Linux
./start.sh
```

脚本自动完成：环境检查 → 依赖安装 → 启动后端（5299）→ 启动前端（5298）

### 手动启动

```bash
git clone https://github.com/Xiphoray/novelbuilder.git
cd novelbuilder

# 终端 1：后端
npm install
npm run server

# 终端 2：前端
npm run dev
```

打开 👉 **http://localhost:5298**

### 配置 AI（5 步搞定）

1. 打开 `#/settings`
2. 选 Provider（OpenAI / Anthropic / OpenAI Compatible）
3. 填 Base URL、API Key、模型 ID
4. 点「**测试连接**」
5. 点「**添加配置**」保存

> 🔐 **安全**：API Key 用 **AES-256-GCM** 加密后存到 `server/config.json` 的 `encryptedKeys` 字段；主密钥 `server/.master.key` 首次启动随机生成且被 `.gitignore` 忽略。**切勿提交 `.master.key` 到仓库**，否则密文可被还原。更换主密钥 = 删除 `.master.key` 重启（已有密文将失效）。

---

## ✨ 核心特性

<table>
<tr>
<td width="50%" valign="top">

### 📖 沉浸式阅读器
- 单列长滚动 + 键盘/鼠标翻页
- Drawer 章节抽屉 + 进度记忆
- 浮动"回到顶部"按钮
- 一键 TXT 导出
- 11+ 阅读参数可调

</td>
<td width="50%" valign="top">

### 🤖 AI 创作搭档
- 11 种文风预设（玄幻/仙侠/都市…）
- 首次生成 2 章，**打开最后一章自动续写 2 章**
- SSE 流式生成，进度实时可见
- 兼容 OpenAI / Anthropic / 任意 OpenAI 协议
- 多 Provider 自由切换

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📚 本地书库
- TXT 拖拽导入，**自动识别 GBK/UTF-8/UTF-16** 等编码
- 智能章节分割（`第X章/节/回`）
- 侧边栏按阅读时间排序
- 书名模糊搜索
- 右键菜单：打开/重命名/下载/删除

</td>
<td width="50%" valign="top">

### 🎨 排版 & 主题
- 字号 14–32px、行距 1.2–2.5、内容宽 600–1200px
- 字体：系统默认 / 宋体 / 楷体 / 等宽
- 三套主题：**亮色 / 暗色 / 护眼**
- 四种预设方案：默认/舒适/夜间/紧凑，一键切换
- CSS 变量驱动，**主题切换零闪烁**

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💾 存储 & 备份
- IndexedDB（Dexie.js）支持 **50MB+** 大小说
- 实时存储监控
- **一键备份 / 恢复**（F-012 全闭环）
- 6 模块：export / import / restore / types / utils / service
- 一键清理残留章节

</td>
<td width="50%" valign="top">

### 📲 PWA 支持（v2.7）
- 完整 `manifest.webmanifest`（lang / 主题色 / 5 图标）
- Service Worker：静态 **Cache First**、导航 **Network First**
- iOS 专用 meta + `apple-touch-icon`
- 后台 60 分钟自动检查更新
- **可安装到桌面，离线可读**

</td>
</tr>
</table>

---

## 🏗️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|:---:|:---:|:---|
| [React](https://react.dev/) | 19 | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 6 | 类型安全 |
| [Vite](https://vitejs.dev/) | 8 | 构建工具 |
| [Ant Design](https://ant.design/) | 5.29 | UI 组件库 |
| [Zustand](https://github.com/pmndrs/zustand) | 5 | 状态管理 |
| [React Router](https://reactrouter.com/) | 7 | 路由（hash 模式）|
| [Dexie.js](https://dexie.org/) | 4.4 | IndexedDB 封装 |
| [uuid](https://github.com/uuidjs/uuid) | 11 | 唯一 ID |
| [jschardet](https://github.com/aadsm/jschardet) | 3.1 | TXT 编码检测 |

### 后端

| 技术 | 版本 | 用途 |
|:---:|:---:|:---|
| [Express](https://expressjs.com/) | 5 | API 服务 + 生产环境静态托管 |
| Node `crypto` | 内置 | **AES-256-GCM** 加密 apiKey |
| SSE | 内置 | AI 流式生成 |

### 工具链

| 技术 | 用途 |
|:---:|:---|
| ESLint 9 | 代码检查 |
| TypeScript Project References | 三段式构建（app/node/shared）|
| Vite Code Splitting | 自动拆包（antd/react/dexie/utils）|

---

## 📁 项目结构

```
novelbuilder/
├── public/                              # 静态资源
│   ├── manifest.webmanifest             # PWA manifest
│   ├── sw.js                            # Service Worker
│   ├── icons/                           # PWA 图标（5 个 SVG）
│   └── favicon.svg
│
├── server/                              # Express 后端
│   ├── index.js                         # 入口（中间件 + 路由）
│   ├── routes/
│   │   ├── config.js                    # AI 配置 CRUD + 测试连接
│   │   └── generate.js                  # AI 生成（首次/追加/摘要/SSE）
│   └── utils/
│       ├── aiClient.js                  # OpenAI / Anthropic 适配
│       ├── cryptoStore.js               # AES-256-GCM 加密
│       ├── configStore.js               # 配置持久化
│       ├── contentParser.js             # 小说内容解析
│       ├── helpers.js                   # 中文数字转换等
│       └── logger.js                    # 日志
│
├── src/                                 # 前端
│   ├── components/
│   │   ├── CreateAIDialog/              # AI 书籍创建
│   │   │   ├── index.tsx
│   │   │   ├── GenerateProgress.tsx
│   │   │   └── useGenerateNovel.ts
│   │   └── Sidebar/                     # 侧边栏书库
│   │       ├── index.tsx
│   │       ├── components/
│   │       └── hooks/
│   ├── pages/
│   │   ├── ReaderPage/                  # 📖 阅读器
│   │   ├── SettingsPage/                # ⚙️ 设置
│   │   └── HistoryPage/                 # 📊 生成历史
│   ├── services/                        # 业务服务层（17 个模块）
│   │   ├── db.ts                        # Dexie 数据库
│   │   ├── ai*.ts                       # AI 调用链路（6 个）
│   │   ├── backup*.ts                   # 备份链路（6 个）
│   │   ├── import*.ts                   # 导入链路（3 个）
│   │   └── exportService.ts
│   ├── stores/                          # Zustand 状态
│   ├── styles/global.css                # 全局样式 + 主题变量
│   └── main.tsx                         # Vite 入口（含 SW 注册）
│
├── start.bat / start.sh                 # 一键启动
├── vite.config.ts                       # 含 /api 代理
├── requirement.md                       # 完整产品需求
└── README.md                            # ← 你正在看
```

---

## 🧩 架构图

### 数据流

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   ReaderPage │────▶│   bookStore  │────▶│  IndexedDB   │
│   (阅读器)   │     │  (Zustand)   │     │  (Dexie.js)  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                     │
        ▼                     ▼
┌──────────────┐     ┌──────────────┐
│ SettingsPage │────▶│settingsStore │
│   (设置)     │     │(LocalStorage)│
└──────────────┘     └──────────────┘
        │
        ▼
┌──────────────┐     ┌──────────────┐
│ Express 后端 │────▶│  AI Provider │
│  (API 代理)  │     │ (OpenAI 等) │
└──────────────┘     └──────────────┘
```

### 开发 / 生产环境

```
开发：浏览器 ──▶ /api/* ──▶ Vite Proxy ──▶ http://localhost:5299/api/*
生产：浏览器 ──▶ /api/* ──▶ Express ──▶ AI Provider
                     └─▶ /icons/*, /sw.js, /manifest.webmanifest (静态)
```

---

## 🧪 构建状态

| 检查项 | 状态 | 详情 |
|:---|:---:|:---|
| `tsc -b` | ✅ | 零错误 |
| `vite build` | ✅ | **1.20s** / 3226 modules |
| 产物大小 | ✅ | `index.html 2.20 kB` + `manifest 1.82 kB` + `sw.js 3.82 kB` + `CSS 16.85 kB (gzip 3.31 kB)` + `11 个 JS chunk` + `5 个 SVG` |
| Chunk 拆分 | ✅ | antd / react / dexie / utils 独立拆包 |
| ESLint | ✅ | 零警告 |

---

## 📊 功能完成度

| 模块 | 完成度 | 说明 |
|:---|:---:|:---|
| 📖 阅读器核心 | 100% | ✅ |
| 📁 侧边栏书库 | 100% | ✅ |
| 🎨 排版设置 | 100% | ✅ |
| 📥 本地导入 | 100% | ✅ 自动编码 + 章节分割 |
| 💾 数据持久化 | 100% | ✅ IndexedDB |
| ⬇️ 书籍导出 | 100% | ✅ TXT 一键下载 |
| 🔌 AI API 配置 | 100% | ✅ 多 Provider |
| 🤖 AI 书籍生成 | 100% | ✅ 流式反馈 |
| 🔄 追加生成 | 100% | ✅ 自动 + 手动 |
| 📦 数据备份恢复 (F-012) | 100% | ✅ 6 模块闭环 |
| 📲 PWA 支持 (F-013) | 100% | ✅ manifest + SW + 图标 |
| 📱 移动端响应式 | 🚧 | 历史页已适配，其余进行中 |
| **整体进度** | **95%** | 🚧 持续迭代中 |

---

## 🗺️ Roadmap

### ✅ 已完成

- [x] 阅读器核心 + 排版设置 + 三套主题
- [x] 侧边栏书库 + 右键菜单 + 搜索
- [x] TXT 导入（自动编码 + 章节分割）
- [x] IndexedDB 持久化
- [x] AI 书籍生成（11 风格 + 多 Provider）
- [x] 自动续写（打开最后一章即触发）
- [x] 生成历史页（筛选 + JSON 导出）
- [x] 一键备份 / 恢复
- [x] PWA 支持（manifest + SW + 离线缓存）

### 🚧 进行中

- [ ] 移动端响应式（阅读区 / 侧边栏 / 设置页小屏适配）

### 📋 待规划（优先级排序）

| # | 功能 | 优先级 | 备注 |
|:---:|:---|:---:|:---|
| 1 | 批量导入多本书 | P1 | 提升开箱即用体验 |
| 2 | AI 润色 / 改写片段 | P1 | 阅读过程中选中段落 → AI 重写 |
| 3 | 错别字自动过滤 | P1 | 生成阶段 + 导入阶段 |
| 4 | 键盘快捷键自定义 | P2 | 阅读/生成/翻页快捷键可配置 |
| 5 | WebDAV 云同步 | P2 | 替代本地备份，多设备同步 |
| 6 | 阅读统计（时长 / 字数 / 章节） | P2 | 个人阅读数据中心 |
| 7 | 暗色 / 护眼主题封面图 | P3 | 沉浸感增强 |
| 8 | EPUB 导入 / 导出 | P3 | 扩大书源 |

完整需求与优先级见 **[`requirement.md`](requirement.md)**。

---

## 🤝 贡献

欢迎 PR / Issue / Star ⭐

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发约定

- 🧩 **组件**：React 函数组件 + Hooks
- 📦 **状态**：Zustand store，避免 prop drilling
- 🎨 **样式**：Ant Design + 全局 CSS 变量主题
- 🔒 **类型**：严格 TypeScript，所有接口在 `types/index.ts` 定义
- 🚦 **路由**：React Router v7，hash 模式
- 🌿 **分支**：`main`（稳定）/ `feature/*`（新功能）/ `fix/*`（修复）

---

## 📄 License

[MIT](LICENSE) © 2026 Novel Builder Contributors

---

## 🙏 致谢

- [Ant Design](https://ant.design/) — 优雅的 UI 组件库
- [Vite](https://vitejs.dev/) — 闪电般的构建体验
- [Dexie.js](https://dexie.org/) — 让 IndexedDB 不再痛苦
- [Zustand](https://github.com/pmndrs/zustand) — 极简的状态管理
- 所有 [Contributors](https://github.com/Xiphoray/novelbuilder/graphs/contributors) ❤️

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

<sub>Made with ❤️ by <a href="https://github.com/Xiphoray">@Xiphoray</a></sub>

</div>
