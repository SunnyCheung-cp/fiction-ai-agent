# UI Redesign — AI 工具风格深色主题 & 流畅创建流程

## Goal

将现有功能性 UI 重设计为 AI 工具风格（深色主题、紫蓝渐变、沉浸式写作），并将小说创建流程简化为"输入标题 → 点击 → 等待生成"两步操作。

## Architecture

- **实现方式**：Tailwind 自定义色板 + 全量页面重写，不引入新组件库
- **不改动**：所有后端逻辑、API 接口、路由结构保持不变
- **新增交互**：快速创建 Modal、AI 初始化全屏进度页、专注写作模式

---

## 视觉语言

### 色彩体系（写入 tailwind.config.js）

```js
colors: {
  base:    '#0a0a0f',   // 页面底色
  surface: '#12121c',   // 卡片/面板
  border:  '#1e1e30',   // 分割线、边框
  accent: {
    from: '#6366f1',    // indigo-500
    to:   '#a855f7',    // purple-500
  },
  text: {
    primary:   '#f1f5f9',
    secondary: '#64748b',
    muted:     '#334155',
  },
  success: '#10b981',
  error:   '#ef4444',
  warning: '#f59e0b',
}
```

### 渐变 & 发光

- **渐变按钮**：`bg-gradient-to-r from-indigo-500 to-purple-500`，hover 时 `opacity-90 + shadow-[0_0_20px_rgba(99,102,241,0.4)]`
- **卡片悬停**：边框从 `border-border` 过渡到 `border-indigo-500/50` + 轻微外发光
- **AI 生成状态**：进度条使用渐变动画 + 脉冲 `animate-pulse`

### 字体

- UI 文字：系统默认 sans-serif
- 写作正文（ChapterDetail 专注模式）：`font-serif`，`text-lg`，`leading-8`，最大宽度 `max-w-2xl`

---

## 布局 & 导航

### 全局 Topbar（`Layout.tsx` 重写）

```
[AI 小说工坊 ▸ 渐变字]          [当前小说名（写作页）]     [  ⚙  ]
```

- 高度 `h-14`，背景 `bg-surface border-b border-border`
- Logo 使用渐变文字 `bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent`
- 接受 `novelTitle` 和 `tabs` 两个可选 prop

### 小说内部 Tab 导航

当 `tabs` prop 存在时，Topbar 下方渲染水平 Tab 栏：

```
章节列表  |  章节大纲  |  设定与角色
   ↑ active：下划线渐变色
```

- Tab 由路由 `useLocation` 判断 active 状态
- 三个 Tab 路径：`/chapters`、`/outline`、`/settings`（设定页包含角色管理，与现在一致）

### NovelDetail 页面处理

`/novels/:novelId` 路由直接重定向到 `/novels/:novelId/chapters`，`NovelDetail.tsx` 不再作为独立页面（Bootstrap 进度整合进 ChapterList）。

---

## 极简创建流程

### 触发

Dashboard 和 NovelList 的「+ 新建小说」按钮打开 `CreateNovelModal` 组件（覆盖层），不跳转路由。

### Modal 结构

```
背景：backdrop-blur-sm bg-black/60

┌── 卡片 bg-surface border border-border rounded-2xl p-8 max-w-md ──┐
│  标题：你的故事叫什么名字？                                          │
│                                                                      │
│  [标题输入框] ← 自动聚焦，Enter 提交                                  │
│                                                                      │
│  ▼ 可选配置（默认折叠，点击展开）                                     │
│    类型提示：___________                                              │
│    章节大纲数：[20]                                                   │
│    AI 模型：◉ Claude  ○ DeepSeek                                     │
│                                                                      │
│  [    开始创作  →    ]  ← 渐变按钮，disabled when title empty         │
└──────────────────────────────────────────────────────────────────────┘
```

### 提交流程

1. 调用 `api.novels.create()`，拿到 `novel_id`
2. 立即 `navigate(/novels/${novel_id}/chapters)`
3. ChapterList 页面在初始加载时调用 `api.outlines.list()`，若返回列表为空则自动展开「AI 初始化进度」区域并开始 bootstrap；若已有大纲则直接显示章节列表（不重复初始化）

### AI 初始化进度（嵌入 ChapterList）

当 bootstrap 进行中时，章节表格区域替换为全屏进度视图：

```
        ✦  正在构建你的故事世界  ✦

   ● 世界观设定        [████████░░]  80%
   ○ 角色档案          [░░░░░░░░░░]
   ○ 章节大纲          [░░░░░░░░░░]

   正在生成世界观设定…
```

- 三个步骤顺序点亮，每步完成后变为 `✓`
- 完成后进度视图淡出，章节列表淡入

---

## 各页面改动详情

### `tailwind.config.js`

扩展 `theme.extend.colors` 写入自定义色板（见上方色彩体系）。

### `index.css`

设置 `body` 背景为 `bg-base`，文字默认 `text-text-primary`。

### `Layout.tsx`（重写）

Props：
```ts
interface LayoutProps {
  children: React.ReactNode
  novelTitle?: string   // 显示在 Topbar 中间
  novelId?: string      // 用于 Tab 链接生成
  activeTab?: 'chapters' | 'outline' | 'settings'  // 对应三个 Tab
}
```

渲染：深色 Topbar + 可选 Tab 栏 + `<main>` 内容区。

### `Dashboard.tsx`（重写）

- 深色 Hero 区域：大标题 + 渐变副标题 + 「+ 新建小说」渐变按钮
- 统计卡片：`bg-surface border-border`，数字用渐变色
- 最近生成列表：深色行，hover 发光
- 内联 `CreateNovelModal`（state 控制显示）

### `NovelList.tsx`（重写）

- 卡片网格（`grid-cols-1 sm:grid-cols-2`）替换原来的列表行
- 每张卡片：标题、创建日期、AI 模型 Badge、章节数、悬停边框发光
- 右上角删除按钮（hover 显示）
- 内联 `CreateNovelModal`

### `CreateNovelModal.tsx`（新建组件）

独立组件，接收 `isOpen` / `onClose` / `onCreated(novelId)` props。包含表单逻辑（create API 调用）。

### `NovelDetail.tsx`（删除）

路由 `/novels/:novelId` 改为重定向到 `/novels/:novelId/chapters`。

### `ChapterList.tsx`（重写）

- 使用新 Layout（含 Tab 导航，activeTab='chapters'）
- 新增：bootstrap 自动检测 + 进度视图
- 章节表格深色样式
- 顶部「生成下一章」改为渐变按钮

### `ChapterDetail.tsx`（重写）

- 默认：深色 Layout + Tab + 章节内容
- 专注模式（按钮切换 or 快捷键 `Ctrl+Enter`）：
  - Topbar 收缩（只显示小说名 + 退出按钮）
  - 隐藏 Tab 导航
  - 内容区：`max-w-2xl mx-auto font-serif text-lg leading-8 text-text-primary`
  - 背景变为更深的 `#080810`
- 流式生成时显示光标动画 `animate-pulse` 在文本末尾

### `Outline.tsx`（重写）

- 新 Layout + Tab（activeTab='outline'）
- AI 生成面板：深色 `bg-surface` 卡片，渐变按钮
- 大纲表格：深色，行 hover 高亮

### `NovelSettings.tsx`（重写）

- Tab activeTab='settings'
- 角色列表整合在同一页（原来已经是）
- 深色输入框、深色卡片

---

## 文件变更清单

| 文件 | 操作 |
|---|---|
| `frontend/tailwind.config.js` | 修改：扩展自定义色板 |
| `frontend/src/index.css` | 修改：全局 body 深色背景 |
| `frontend/src/App.tsx` | 修改：`/novels/:id` 重定向到 `/novels/:id/chapters` |
| `frontend/src/components/Layout.tsx` | 重写：深色 Topbar + Tab 导航 |
| `frontend/src/components/CreateNovelModal.tsx` | 新建：快速创建 Modal |
| `frontend/src/pages/Dashboard.tsx` | 重写：深色 Hero + 统计卡片 |
| `frontend/src/pages/NovelList.tsx` | 重写：深色卡片网格 |
| `frontend/src/pages/NovelCreate.tsx` | 删除（功能移入 Modal） |
| `frontend/src/pages/NovelDetail.tsx` | 删除（路由重定向） |
| `frontend/src/pages/ChapterList.tsx` | 重写：含 bootstrap 进度视图 |
| `frontend/src/pages/ChapterDetail.tsx` | 重写：专注写作模式 |
| `frontend/src/pages/Outline.tsx` | 重写：新 Layout + Tab |
| `frontend/src/pages/NovelSettings.tsx` | 重写：新 Layout + Tab |

---

## 不在本次范围内

- 后端任何改动
- 用户认证 / 多租户（Phase 1，下一期）
- 导出 / 分享功能（Phase 3）
- 计费（Phase 4）
