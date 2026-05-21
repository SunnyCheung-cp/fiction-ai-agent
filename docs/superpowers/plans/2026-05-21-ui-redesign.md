# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all frontend pages to an AI-tool dark theme (indigo/purple gradient accents), replace the two-step novel creation with a single modal, and add immersive focus writing mode.

**Architecture:** Extend Tailwind with 4 custom dark colors; rewrite Layout with a dark Topbar + 3-Tab novel navigation; add a `CreateNovelModal` component that creates and immediately bootstraps; rewrite all 8 pages to use the new theme. No backend changes.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v3, react-router-dom v7

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/tailwind.config.js` | Modify | Custom dark color palette |
| `frontend/src/index.css` | Modify | Dark body background |
| `frontend/src/components/Layout.tsx` | Rewrite | Dark Topbar + 3-Tab nav |
| `frontend/src/components/CreateNovelModal.tsx` | Create | Quick-create modal |
| `frontend/src/api/client.ts` | Modify | Add `provider` to create type; add `onStepComplete` to bootstrap |
| `frontend/src/App.tsx` | Modify | Remove old routes, add redirect |
| `frontend/src/pages/Dashboard.tsx` | Rewrite | Dark hero + stats + modal |
| `frontend/src/pages/NovelList.tsx` | Rewrite | Dark card grid + modal |
| `frontend/src/pages/ChapterList.tsx` | Rewrite | Bootstrap auto-detect + progress animation |
| `frontend/src/pages/ChapterDetail.tsx` | Rewrite | Focus writing mode |
| `frontend/src/pages/Outline.tsx` | Rewrite | New Layout + Tab |
| `frontend/src/pages/NovelSettings.tsx` | Rewrite | New Layout + Tab |
| `frontend/src/pages/NovelCreate.tsx` | Delete | Replaced by modal |
| `frontend/src/pages/NovelDetail.tsx` | Delete | Replaced by redirect + Tab |

**No backend files change.**

---

## Task 1: Tailwind Config + Global CSS

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Write new Tailwind config**

Replace the entire file:

```js
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        surface: '#12121c',
        'surface-hover': '#1a1a2e',
        rim: '#1e1e30',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Update index.css**

Replace the entire file:

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0a0a0f;
  color: #f1f5f9;
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/tailwind.config.js frontend/src/index.css
git commit -m "feat: dark theme color palette and global CSS"
```

---

## Task 2: Layout Component

**Files:**
- Rewrite: `frontend/src/components/Layout.tsx`

The new Layout has: a fixed dark Topbar (logo + optional novel title); an optional 3-Tab bar below it for novel pages; a main content area with correct top padding.

- [ ] **Step 1: Write new Layout**

Replace the entire file:

```tsx
// frontend/src/components/Layout.tsx
import { useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
  novelTitle?: string
  novelId?: string
  activeTab?: 'chapters' | 'outline' | 'settings'
  // backward-compat: old pages pass breadcrumbs until deleted in Task 11
  breadcrumbs?: unknown
}

const TABS = [
  { key: 'chapters' as const, label: '章节列表', href: (id: string) => `/novels/${id}/chapters` },
  { key: 'outline' as const, label: '章节大纲', href: (id: string) => `/novels/${id}/outline` },
  { key: 'settings' as const, label: '设定与角色', href: (id: string) => `/novels/${id}/settings` },
]

export default function Layout({ children, novelTitle, novelId, activeTab }: LayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-base text-slate-100">
      {/* Topbar */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-surface border-b border-rim flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity shrink-0"
        >
          AI 小说工坊
        </button>
        {novelTitle && (
          <span className="text-sm text-slate-400 truncate">{novelTitle}</span>
        )}
      </header>

      {/* Tab navigation — only when inside a novel */}
      {novelId && (
        <nav className="fixed top-14 inset-x-0 z-40 bg-surface border-b border-rim">
          <div className="max-w-5xl mx-auto px-6 flex">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => navigate(tab.href(novelId))}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main */}
      <main className={`max-w-5xl mx-auto px-6 pb-16 ${novelId ? 'pt-[7rem]' : 'pt-20'}`}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/components/Layout.tsx
git commit -m "feat: dark Topbar + 3-Tab novel navigation"
```

---

## Task 3: API Client Updates + CreateNovelModal

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/components/CreateNovelModal.tsx`

Two API changes:
1. `api.novels.create` body type is missing `provider` — add it
2. `api.novels.bootstrap` needs an `onStepComplete` callback so ChapterList can animate step transitions (fires when `world_bible`, `characters`, `outlines` SSE events arrive)

- [ ] **Step 1: Update api/client.ts**

Open `frontend/src/api/client.ts`. Make these two targeted edits:

**Edit 1** — add `provider` to `create` body type (line ~22):

```ts
    create: (body: { title: string; world_bible?: string; auto_generate?: boolean; daily_time?: string; provider?: string }) =>
      req<Novel>('/novels', { method: 'POST', body: JSON.stringify(body) }),
```

**Edit 2** — replace the `bootstrap` method signature and body to add `onStepComplete`:

```ts
    bootstrap: async (
      novelId: string,
      chapters: number,
      genreHint: string,
      onProgress: (message: string) => void,
      onStepComplete: (step: 'world_bible' | 'characters' | 'outlines') => void,
      onDone: (summary: { characters: number; outlines: number }) => void,
      onError: (err: string) => void
    ) => {
      const params = new URLSearchParams({
        chapters: String(chapters),
        genre_hint: genreHint,
      })
      const res = await fetch(`${BASE}/novels/${novelId}/bootstrap?${params}`, {
        method: 'POST',
      })
      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6)
            if (payload === '[DONE]') return
            try {
              const parsed = JSON.parse(payload)
              if (parsed.type === 'error') { onError(parsed.message); return }
              if (parsed.type === 'progress') onProgress(parsed.message)
              if (parsed.type === 'world_bible') onStepComplete('world_bible')
              if (parsed.type === 'characters') onStepComplete('characters')
              if (parsed.type === 'outlines') onStepComplete('outlines')
              if (parsed.type === 'done') { onDone({ characters: parsed.characters, outlines: parsed.outlines }); return }
            } catch (e) {
              console.warn('bootstrap SSE parse error', e)
            }
          }
        }
      } catch (e) {
        onError(String(e))
      }
    },
```

- [ ] **Step 2: Update NovelDetail.tsx bootstrap call to add the new parameter**

`NovelDetail.tsx` calls `api.novels.bootstrap` with the old signature (5 args). Add the missing `onStepComplete` arg (a no-op) to keep it compiling:

Open `frontend/src/pages/NovelDetail.tsx`, find the `api.novels.bootstrap(` call, and add `() => {}` as the 4th argument (after `onProgress`, before `onDone`):

```tsx
      await api.novels.bootstrap(
        novelId,
        bootstrapChapters,
        bootstrapGenre,
        msg => setBootstrapLog(prev => [...prev, msg]),
        () => {},   // onStepComplete — no-op, progress log is enough here
        summary => {
          setBootstrapLog(prev => [...prev, `✅ 完成：${summary.characters} 个角色，${summary.outlines} 章大纲`])
          setBootstrapping(false)
          setShowBootstrap(false)
          api.novels.get(novelId!).then(setNovel).catch(console.error)
          api.characters.list(novelId!).then(setCharacters).catch(console.error)
          api.chapters.list(novelId!).then(chs => setChapterCount(chs.filter(c => c.has_content).length)).catch(console.error)
          api.outlines.list(novelId!).then(os => setOutlineCount(os.length)).catch(console.error)
        },
        err => {
          setBootstrapLog(prev => [...prev, `❌ 错误: ${err}`])
          setBootstrapping(false)
        }
      )
```

- [ ] **Step 3: Create CreateNovelModal.tsx**

```tsx
// frontend/src/components/CreateNovelModal.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function CreateNovelModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [genreHint, setGenreHint] = useState('')
  const [chapters, setChapters] = useState(20)
  const [provider, setProvider] = useState<'anthropic' | 'deepseek'>('anthropic')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setTitle('')
    setGenreHint('')
    setChapters(20)
    setProvider('anthropic')
    setShowAdvanced(false)
    setCreating(false)
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!title.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const novel = await api.novels.create({ title: title.trim(), provider })
      const params = new URLSearchParams({ auto_init: '1', init_chapters: String(chapters) })
      if (genreHint.trim()) params.set('init_genre', genreHint.trim())
      handleClose()
      navigate(`/novels/${novel.id}/chapters?${params}`)
    } catch {
      setError('创建失败，请重试')
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-surface border border-rim rounded-2xl p-8 w-full max-w-md mx-4 space-y-6">
        <h2 className="text-xl font-semibold text-slate-100">你的故事叫什么名字？</h2>

        <input
          autoFocus
          type="text"
          placeholder="输入小说标题…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-base border border-rim rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />

        <div>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? '▾' : '▸'} 可选配置
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">类型提示</label>
                <input
                  type="text"
                  placeholder="如：玄幻、都市、科幻…"
                  value={genreHint}
                  onChange={e => setGenreHint(e.target.value)}
                  className="w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">章节大纲数</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={chapters}
                  onChange={e => setChapters(Number(e.target.value))}
                  className="w-24 bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">AI 模型</label>
                <div className="flex gap-4">
                  {(['anthropic', 'deepseek'] as const).map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modal-provider"
                        checked={provider === p}
                        onChange={() => setProvider(p)}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-slate-300">
                        {p === 'anthropic' ? 'Claude' : 'DeepSeek'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 border border-rim text-slate-400 rounded-lg py-2.5 text-sm hover:bg-surface-hover transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || creating}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:shadow-none"
          >
            {creating ? '创建中…' : '开始创作 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/api/client.ts frontend/src/pages/NovelDetail.tsx frontend/src/components/CreateNovelModal.tsx
git commit -m "feat: CreateNovelModal, add provider to create API, bootstrap step callbacks"
```

---

## Task 4: Dashboard Page

**Files:**
- Rewrite: `frontend/src/pages/Dashboard.tsx`

Dark hero section, glowing stat cards, recent chapters list, inline modal.

- [ ] **Step 1: Rewrite Dashboard.tsx**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CreateNovelModal from '../components/CreateNovelModal'
import { api } from '../api/client'
import type { Stats } from '../api/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.stats.get().then(setStats).catch(console.error)
  }, [])

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <div className="pt-8 pb-4 space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI 小说工坊
          </h1>
          <p className="text-slate-400 text-lg">输入标题，AI 自动构建世界观、角色与大纲</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-all shadow-[0_0_24px_rgba(99,102,241,0.35)] text-sm"
          >
            + 新建小说
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="小说总数" value={stats?.novel_count ?? '—'} icon="📖" />
          <StatCard label="已写章节" value={stats?.total_chapters ?? '—'} icon="✍️" />
          <StatCard label="自动生成中" value={stats?.auto_gen_count ?? '—'} icon="⚡" />
        </div>

        {/* Recent chapters */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-300">最近生成</h2>
          {(!stats?.recent_chapters || stats.recent_chapters.length === 0) && (
            <p className="text-slate-600 text-sm">暂无生成记录</p>
          )}
          <div className="space-y-2">
            {stats?.recent_chapters?.map(ch => (
              <div
                key={`${ch.novel_id}-${ch.chapter_num}`}
                className="bg-surface border border-rim rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:border-indigo-500/50 hover:bg-surface-hover transition-all group"
                onClick={() => navigate(`/novels/${ch.novel_id}/chapters/${ch.chapter_num}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-200">{ch.novel_title}</span>
                  <span className="text-slate-500 text-sm">第 {ch.chapter_num} 章</span>
                </div>
                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
                  {ch.created_at.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <button
          className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          onClick={() => navigate('/novels')}
        >
          查看全部小说 →
        </button>
      </div>

      <CreateNovelModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Layout>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-surface border border-rim rounded-xl p-5 hover:border-indigo-500/40 transition-colors">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: dark Dashboard with hero, stats cards, modal"
```

---

## Task 5: NovelList Page

**Files:**
- Rewrite: `frontend/src/pages/NovelList.tsx`

Dark card grid replacing the plain list. Each card: title, date, AI badge, chapter count (omit for now — not in list API), delete button on hover.

- [ ] **Step 1: Rewrite NovelList.tsx**

```tsx
// frontend/src/pages/NovelList.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CreateNovelModal from '../components/CreateNovelModal'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function NovelList() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.novels.list().then(setNovels).catch(console.error)
  }, [])

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation()
    if (!window.confirm(`确定删除《${title}》？此操作不可恢复。`)) return
    await api.novels.delete(id).catch(console.error)
    setNovels(prev => prev.filter(n => n.id !== id))
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-bold text-slate-100">我的小说</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-[0_0_16px_rgba(99,102,241,0.3)]"
          >
            + 新建小说
          </button>
        </div>

        {novels.length === 0 && (
          <p className="text-slate-600 text-sm pt-4">暂无小说，点击「新建小说」开始创作</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {novels.map(n => (
            <div
              key={n.id}
              className="bg-surface border border-rim rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 hover:bg-surface-hover transition-all group relative"
              onClick={() => navigate(`/novels/${n.id}/chapters`)}
            >
              <div className="pr-8 space-y-2">
                <div className="font-semibold text-slate-100 text-base leading-snug">{n.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{n.created_at?.slice(0, 10)}</span>
                  <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    {n.provider === 'deepseek' ? 'DeepSeek' : 'Claude'}
                  </span>
                  {n.auto_generate && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      每日 {n.daily_time}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="absolute top-4 right-4 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none"
                onClick={e => handleDelete(e, n.id, n.title)}
                title="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <CreateNovelModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Layout>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/NovelList.tsx
git commit -m "feat: dark card grid novel list with inline modal"
```

---

## Task 6: App.tsx Routing

**Files:**
- Modify: `frontend/src/App.tsx`

Remove the `/novels/new` and `/novels/:novelId` routes (those pages will be deleted). Add a redirect from `/novels/:novelId` to `/novels/:novelId/chapters`.

- [ ] **Step 1: Rewrite App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NovelList from './pages/NovelList'
import NovelDetail from './pages/NovelDetail'
import ChapterList from './pages/ChapterList'
import ChapterDetail from './pages/ChapterDetail'
import NovelSettings from './pages/NovelSettings'
import OutlinePage from './pages/Outline'

function NovelRedirect() {
  const { novelId } = useParams<{ novelId: string }>()
  return <Navigate to={`/novels/${novelId}/chapters`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/novels" element={<NovelList />} />
        <Route path="/novels/:novelId" element={<NovelRedirect />} />
        <Route path="/novels/:novelId/chapters" element={<ChapterList />} />
        <Route path="/novels/:novelId/chapters/:num" element={<ChapterDetail />} />
        <Route path="/novels/:novelId/settings" element={<NovelSettings />} />
        <Route path="/novels/:novelId/outline" element={<OutlinePage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

Note: `NovelDetail` is still imported here because it's not deleted yet (Task 11). The `NovelDetail` import line must remain until Task 11. Wait — `NovelRedirect` replaces the `NovelDetail` route, so remove the import now to avoid an unused-import warning:

Actually `NovelDetail` export will exist until Task 11. But the `import NovelDetail` line in App.tsx is now unused. TypeScript with `noUnusedLocals` will warn. Remove the import to keep the build clean.

The final App.tsx (no NovelDetail import, no NovelCreate import):

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NovelList from './pages/NovelList'
import ChapterList from './pages/ChapterList'
import ChapterDetail from './pages/ChapterDetail'
import NovelSettings from './pages/NovelSettings'
import OutlinePage from './pages/Outline'

function NovelRedirect() {
  const { novelId } = useParams<{ novelId: string }>()
  return <Navigate to={`/novels/${novelId}/chapters`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/novels" element={<NovelList />} />
        <Route path="/novels/:novelId" element={<NovelRedirect />} />
        <Route path="/novels/:novelId/chapters" element={<ChapterList />} />
        <Route path="/novels/:novelId/chapters/:num" element={<ChapterDetail />} />
        <Route path="/novels/:novelId/settings" element={<NovelSettings />} />
        <Route path="/novels/:novelId/outline" element={<OutlinePage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/App.tsx
git commit -m "feat: remove old routes, add novel/:id redirect to chapters"
```

---

## Task 7: ChapterList Page

**Files:**
- Rewrite: `frontend/src/pages/ChapterList.tsx`

This is the most complex page. On load it checks URL search params for `auto_init=1`. If found AND no outlines exist, it starts bootstrap automatically and shows an animated 3-step progress view. The chapter table is dark-styled.

- [ ] **Step 1: Rewrite ChapterList.tsx**

```tsx
// frontend/src/pages/ChapterList.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { ChapterListItem, Novel } from '../api/types'

type BootstrapStep = 'idle' | 'world_bible' | 'characters' | 'outlines' | 'done' | 'error'

const STEP_LABELS: Record<string, string> = {
  world_bible: '世界观设定',
  characters: '角色档案',
  outlines: '章节大纲',
}
const STEP_ORDER: BootstrapStep[] = ['world_bible', 'characters', 'outlines']

export default function ChapterList() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [novel, setNovel] = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<ChapterListItem[]>([])
  const [generatingNum, setGeneratingNum] = useState<number | null>(null)
  const [streamStatus, setStreamStatus] = useState('')

  // Bootstrap state
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapStep, setBootstrapStep] = useState<BootstrapStep>('idle')
  const [bootstrapLog, setBootstrapLog] = useState('')
  const [bootstrapError, setBootstrapError] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)

    const autoInit = searchParams.get('auto_init') === '1'
    const initChapters = Number(searchParams.get('init_chapters') ?? '20')
    const initGenre = searchParams.get('init_genre') ?? ''

    api.outlines.list(novelId).then(outlines => {
      if (autoInit && outlines.length === 0) {
        // Inline bootstrap start to avoid stale closure from external function ref
        setBootstrapping(true)
        setBootstrapStep('world_bible')
        setBootstrapError('')
        api.novels.bootstrap(
          novelId,
          initChapters,
          initGenre,
          msg => setBootstrapLog(msg),
          step => setBootstrapStep(step),
          () => {
            setBootstrapStep('done')
            setBootstrapping(false)
            api.chapters.list(novelId).then(setChapters).catch(console.error)
          },
          err => {
            setBootstrapError(err)
            setBootstrapping(false)
          }
        )
      } else {
        api.chapters.list(novelId).then(setChapters).catch(console.error)
      }
    }).catch(console.error)
  }, [novelId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(chapterNum: number) {
    if (!novelId || generatingNum !== null) return
    setGeneratingNum(chapterNum)
    setStreamStatus('生成中…')
    try {
      await api.chapters.generateStream(
        novelId,
        chapterNum,
        () => {},
        () => {
          setGeneratingNum(null)
          setStreamStatus('')
          api.chapters.list(novelId!).then(setChapters).catch(console.error)
        },
        err => {
          setGeneratingNum(null)
          setStreamStatus(`错误: ${err}`)
        }
      )
    } catch (err) {
      setGeneratingNum(null)
      setStreamStatus(`错误: ${String(err)}`)
    }
  }

  function getNextUnwritten(): number {
    if (chapters.length === 0) return 1
    const unwritten = chapters.find(c => !c.has_content)
    if (unwritten) return unwritten.chapter_num
    return Math.max(...chapters.map(c => c.chapter_num)) + 1
  }

  const title = novel?.title ?? '…'

  // Bootstrap in progress — show animated step view
  if (bootstrapping || bootstrapStep === 'done') {
    return (
      <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-sm">
              {bootstrapStep === 'done' ? '初始化完成' : 'AI 正在构建你的故事世界'}
            </p>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {title}
            </h2>
          </div>

          <div className="w-full max-w-sm space-y-4">
            {STEP_ORDER.map((step, idx) => {
              const currentIdx = STEP_ORDER.indexOf(bootstrapStep as BootstrapStep)
              const isDone = bootstrapStep === 'done' || idx < currentIdx
              const isActive = step === bootstrapStep
              return (
                <div key={step} className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    isDone
                      ? 'bg-indigo-500 text-white'
                      : isActive
                      ? 'bg-indigo-500/20 border border-indigo-500 text-indigo-400 animate-pulse'
                      : 'bg-surface border border-rim text-slate-600'
                  }`}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isDone ? 'text-slate-300' : isActive ? 'text-indigo-300' : 'text-slate-600'}`}>
                      {STEP_LABELS[step]}
                    </div>
                    {isActive && bootstrapLog && (
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{bootstrapLog}</div>
                    )}
                  </div>
                  {isActive && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />}
                </div>
              )
            })}
          </div>

          {bootstrapStep === 'done' && (
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              onClick={() => setBootstrapStep('idle')}
            >
              开始写作 →
            </button>
          )}
        </div>
      </Layout>
    )
  }

  if (bootstrapError) {
    return (
      <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
          <p className="text-red-400">初始化失败：{bootstrapError}</p>
          <button
            className="text-sm text-indigo-400 hover:text-indigo-300"
            onClick={() => { setBootstrapError(''); api.chapters.list(novelId!).then(setChapters).catch(console.error) }}
          >
            跳过，手动配置 →
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">章节列表</h1>
          <div className="flex items-center gap-3">
            {streamStatus && (
              <span className={`text-sm ${streamStatus.startsWith('错误') ? 'text-red-400' : 'text-emerald-400'}`}>
                {streamStatus}
              </span>
            )}
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
              disabled={generatingNum !== null}
              onClick={() => handleGenerate(getNextUnwritten())}
            >
              {generatingNum !== null ? `生成第 ${generatingNum} 章…` : '生成下一章'}
            </button>
          </div>
        </div>

        {chapters.length === 0 && (
          <p className="text-slate-600 text-sm">暂无章节。请先在「章节大纲」中添加大纲，然后点击「生成下一章」。</p>
        )}

        {chapters.length > 0 && (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rim">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-16">章节</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-20">状态</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-20">字数</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">摘要</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map(ch => (
                  <tr key={ch.chapter_num} className="border-b border-rim last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-slate-300">{ch.chapter_num}</td>
                    <td className="px-4 py-3">
                      {ch.has_content ? (
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">已写</span>
                      ) : (
                        <span className="text-xs bg-slate-800 text-slate-500 border border-rim px-2 py-0.5 rounded-full">未写</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{ch.word_count > 0 ? ch.word_count : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{ch.summary || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      {ch.has_content && (
                        <button
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                          onClick={() => navigate(`/novels/${novelId}/chapters/${ch.chapter_num}`)}
                        >
                          查看
                        </button>
                      )}
                      <button
                        className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
                        disabled={generatingNum !== null}
                        onClick={() => handleGenerate(ch.chapter_num)}
                      >
                        {ch.has_content ? '重写' : '生成'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/ChapterList.tsx
git commit -m "feat: ChapterList with auto-bootstrap progress animation and dark table"
```

---

## Task 8: ChapterDetail Page

**Files:**
- Rewrite: `frontend/src/pages/ChapterDetail.tsx`

Normal view uses Layout with Tabs. Focus mode renders its own minimal wrapper with serif font, wider text area, darker background — no Layout.

- [ ] **Step 1: Rewrite ChapterDetail.tsx**

```tsx
// frontend/src/pages/ChapterDetail.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Chapter, Novel } from '../api/types'

export default function ChapterDetail() {
  const { novelId, num } = useParams<{ novelId: string; num: string }>()
  const navigate = useNavigate()
  const chapterNum = Number(num)

  const [novel, setNovel] = useState<Novel | null>(null)
  const [totalChapters, setTotalChapters] = useState(0)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.chapters.list(novelId).then(chs =>
      setTotalChapters(chs.length > 0 ? Math.max(...chs.map(c => c.chapter_num)) : 0)
    ).catch(console.error)
  }, [novelId])

  useEffect(() => {
    if (!novelId || !chapterNum) return
    api.chapters.get(novelId, chapterNum).then(ch => {
      setChapter(ch)
      setEditContent(ch.content)
    }).catch(console.error)
  }, [novelId, chapterNum])

  useEffect(() => {
    if (isGenerating && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [chapter?.content, isGenerating])

  // Esc exits focus mode
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  async function handleRegenerate() {
    if (!novelId || isGenerating) return
    setIsGenerating(true)
    setStatus('生成中…')
    setChapter(prev => prev ? { ...prev, content: '' } : null)
    setEditContent('')
    setEditing(false)
    try {
      await api.chapters.generateStream(
        novelId,
        chapterNum,
        chunk => {
          setChapter(prev => prev ? { ...prev, content: (prev.content || '') + chunk } : null)
          setEditContent(prev => prev + chunk)
        },
        () => {
          setIsGenerating(false)
          setStatus('已完成')
          setTimeout(() => setStatus(''), 3000)
          api.chapters.get(novelId!, chapterNum).then(ch => {
            setChapter(ch)
            setEditContent(ch.content)
          }).catch(console.error)
        },
        err => {
          setIsGenerating(false)
          setStatus(`错误: ${err}`)
        }
      )
    } catch (err) {
      setIsGenerating(false)
      setStatus(`错误: ${String(err)}`)
    }
  }

  async function handleSave() {
    if (!novelId || isSaving) return
    setIsSaving(true)
    try {
      const updated = await api.chapters.update(novelId, chapterNum, editContent)
      setChapter(updated)
      setEditing(false)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const title = novel?.title ?? '…'

  const toolbar = (
    <div className="flex items-center gap-2">
      {status && (
        <span className={`text-sm ${status.startsWith('错误') || status.startsWith('保存失败') ? 'text-red-400' : 'text-emerald-400'}`}>
          {status}
        </span>
      )}
      {!editing && !isGenerating && (
        <button
          className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
          onClick={() => setFocusMode(v => !v)}
        >
          {focusMode ? '退出专注' : '专注模式'}
        </button>
      )}
      {!editing && (
        <button
          className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover disabled:opacity-40 transition-colors"
          disabled={isGenerating}
          onClick={() => setEditing(true)}
        >
          编辑
        </button>
      )}
      {editing && (
        <>
          <button
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            disabled={isSaving}
            onClick={handleSave}
          >
            保存
          </button>
          <button
            className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
            onClick={() => { setEditing(false); setEditContent(chapter?.content ?? '') }}
          >
            取消
          </button>
        </>
      )}
      <button
        className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-40 transition-all"
        disabled={isGenerating}
        onClick={handleRegenerate}
      >
        {isGenerating ? '生成中…' : '重新生成'}
      </button>
    </div>
  )

  const meta = chapter && (
    <div className="flex gap-4 text-sm text-slate-600">
      <span>{chapter.content.length} 字</span>
      {chapter.summary && <span className="truncate max-w-md">· {chapter.summary}</span>}
    </div>
  )

  const contentArea = editing ? (
    <textarea
      className="w-full bg-base border border-rim rounded-xl px-6 py-5 h-[65vh] text-slate-200 leading-7 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
      value={editContent}
      onChange={e => setEditContent(e.target.value)}
    />
  ) : (
    <div
      ref={contentRef}
      className={`w-full border border-rim rounded-xl px-6 py-5 h-[65vh] overflow-y-auto bg-surface text-slate-200 leading-7 whitespace-pre-wrap ${
        focusMode ? 'font-serif text-lg leading-8 max-w-2xl mx-auto' : ''
      }`}
    >
      {chapter?.content || <span className="text-slate-700">（暂无内容）</span>}
      {isGenerating && <span className="inline-block w-0.5 h-5 bg-indigo-400 animate-pulse ml-1 align-middle" />}
    </div>
  )

  const prevNext = (
    <div className="flex justify-between text-sm">
      {chapterNum > 1 ? (
        <button
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum - 1}`)}
        >
          ← 第 {chapterNum - 1} 章
        </button>
      ) : <span />}
      {chapterNum < totalChapters ? (
        <button
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum + 1}`)}
        >
          第 {chapterNum + 1} 章 →
        </button>
      ) : <span />}
    </div>
  )

  // Focus mode — own full-screen wrapper, no Layout
  if (focusMode) {
    return (
      <div className="min-h-screen bg-[#080810] text-slate-200">
        <header className="fixed top-0 inset-x-0 h-12 bg-[#080810] border-b border-rim flex items-center justify-between px-8 z-50">
          <span className="text-sm text-slate-500">{title} · 第 {chapterNum} 章</span>
          <div className="flex items-center gap-4">
            {toolbar}
          </div>
        </header>
        <main className="pt-16 pb-16 px-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {meta}
            {contentArea}
            {prevNext}
          </div>
        </main>
      </div>
    )
  }

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">第 {chapterNum} 章</h1>
          {toolbar}
        </div>
        {meta}
        {contentArea}
        {prevNext}
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/ChapterDetail.tsx
git commit -m "feat: ChapterDetail with focus writing mode and dark styling"
```

---

## Task 9: Outline Page

**Files:**
- Rewrite: `frontend/src/pages/Outline.tsx`

- [ ] **Step 1: Rewrite Outline.tsx**

```tsx
// frontend/src/pages/Outline.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Outline, Novel } from '../api/types'

export default function OutlinePage() {
  const { novelId } = useParams<{ novelId: string }>()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [newChapterNum, setNewChapterNum] = useState(1)
  const [newOutlineText, setNewOutlineText] = useState('')

  const [genStart, setGenStart] = useState(1)
  const [genCount, setGenCount] = useState(20)
  const [generating, setGenerating] = useState(false)
  const [genLog, setGenLog] = useState<string[]>([])

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.outlines.list(novelId).then(os => {
      setOutlines(os)
      if (os.length > 0) {
        const max = Math.max(...os.map(o => o.chapter_num))
        setGenStart(max + 1)
        setNewChapterNum(max + 1)
      }
    }).catch(console.error)
  }, [novelId])

  async function handleUpsert(chapterNum: number, text: string) {
    if (!novelId) return
    const updated = await api.outlines.upsert(novelId, chapterNum, text)
    setOutlines(prev => {
      const exists = prev.find(o => o.chapter_num === chapterNum)
      if (exists) return prev.map(o => o.chapter_num === chapterNum ? updated : o)
      return [...prev, updated].sort((a, b) => a.chapter_num - b.chapter_num)
    })
  }

  async function handleAddNew() {
    if (!newOutlineText.trim()) return
    await handleUpsert(newChapterNum, newOutlineText)
    setNewOutlineText('')
    setNewChapterNum(prev => prev + 1)
  }

  async function handleGenerate() {
    if (!novelId || generating) return
    setGenerating(true)
    setGenLog([])
    await api.outlines.generate(
      novelId,
      genStart,
      genCount,
      msg => setGenLog(prev => [...prev, msg]),
      count => {
        setGenLog(prev => [...prev, `✓ 已生成 ${count} 章大纲`])
        setGenerating(false)
        api.outlines.list(novelId!).then(os => {
          setOutlines(os)
          const max = Math.max(...os.map(o => o.chapter_num))
          setGenStart(max + 1)
        }).catch(console.error)
      },
      err => {
        setGenLog(prev => [...prev, `错误: ${err}`])
        setGenerating(false)
      }
    )
  }

  const title = novel?.title ?? '…'

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="outline">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-100">章节大纲</h1>

        {/* AI Generate Panel */}
        <div className="bg-surface border border-rim rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">AI 生成大纲</h2>
              <p className="text-xs text-slate-500 mt-0.5">根据世界观和角色自动生成章节大纲</p>
            </div>
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? '生成中…' : 'AI 生成'}
            </button>
          </div>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">从第几章开始</label>
              <input
                type="number"
                min={1}
                value={genStart}
                onChange={e => setGenStart(Number(e.target.value))}
                disabled={generating}
                className="w-20 bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">生成章节数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={genCount}
                onChange={e => setGenCount(Number(e.target.value))}
                disabled={generating}
                className="w-20 bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
              />
            </div>
          </div>
          {genLog.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-rim">
              {genLog.map((log, i) => (
                <p key={i} className="text-xs text-slate-400">{log}</p>
              ))}
            </div>
          )}
        </div>

        {/* Outline table */}
        {outlines.length === 0 && !generating && (
          <p className="text-slate-600 text-sm">暂无大纲，点击「AI 生成」自动创建，或手动添加</p>
        )}

        {outlines.length > 0 && (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rim">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-16">章节</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">大纲</th>
                </tr>
              </thead>
              <tbody>
                {outlines.map(o => (
                  <tr key={o.chapter_num} className="border-b border-rim last:border-0">
                    <td className="px-4 py-2 font-mono text-sm text-slate-400">{o.chapter_num}</td>
                    <td className="px-2 py-1">
                      <textarea
                        className="w-full bg-transparent text-sm text-slate-300 px-2 py-1 resize-none focus:outline-none focus:bg-surface-hover rounded transition-colors"
                        rows={2}
                        defaultValue={o.outline}
                        onBlur={e => handleUpsert(o.chapter_num, e.target.value).catch(console.error)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual add */}
        <div className="bg-surface border border-rim rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-400">手动添加</p>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-500">第</span>
            <input
              type="number"
              min={1}
              value={newChapterNum}
              onChange={e => setNewChapterNum(Number(e.target.value))}
              className="w-16 bg-base border border-rim rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <span className="text-sm text-slate-500">章</span>
          </div>
          <textarea
            className="w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 h-20 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="大纲内容…"
            value={newOutlineText}
            onChange={e => setNewOutlineText(e.target.value)}
          />
          <button
            className="bg-surface-hover border border-rim text-slate-300 px-3 py-1.5 rounded-lg text-sm hover:border-indigo-500/50 disabled:opacity-40 transition-colors"
            disabled={!newOutlineText.trim()}
            onClick={() => handleAddNew().catch(console.error)}
          >
            添加
          </button>
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/Outline.tsx
git commit -m "feat: dark Outline page with Tab nav and AI generate panel"
```

---

## Task 10: NovelSettings Page

**Files:**
- Rewrite: `frontend/src/pages/NovelSettings.tsx`

- [ ] **Step 1: Rewrite NovelSettings.tsx**

```tsx
// frontend/src/pages/NovelSettings.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Character, Novel } from '../api/types'

export default function NovelSettings() {
  const { novelId } = useParams<{ novelId: string }>()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [worldBible, setWorldBible] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [charProfiles, setCharProfiles] = useState<Record<string, string>>({})
  const [newCharName, setNewCharName] = useState('')
  const [newCharProfile, setNewCharProfile] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [provider, setProvider] = useState<'anthropic' | 'deepseek'>('anthropic')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setNovel(n)
      setWorldBible(n.world_bible)
      setAutoGenerate(n.auto_generate)
      setDailyTime(n.daily_time ?? '08:00')
      setProvider((n.provider as 'anthropic' | 'deepseek') ?? 'anthropic')
    }).catch(console.error)
    api.characters.list(novelId).then(chars => {
      setCharacters(chars)
      setCharProfiles(Object.fromEntries(chars.map(c => [c.id, c.profile])))
    }).catch(console.error)
  }, [novelId])

  async function handleSaveAll() {
    if (!novelId) return
    setSaving(true)
    setStatus('')
    try {
      await api.novels.update(novelId, { world_bible: worldBible, auto_generate: autoGenerate, daily_time: dailyTime, provider })
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCharacter() {
    if (!novelId || !newCharName || !newCharProfile) return
    setSaving(true)
    try {
      const char = await api.characters.create(novelId, newCharName, newCharProfile)
      setCharacters(prev => [...prev, char])
      setCharProfiles(prev => ({ ...prev, [char.id]: char.profile }))
      setNewCharName('')
      setNewCharProfile('')
    } catch {
      setStatus('添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateChar(charId: string, profile: string) {
    if (!novelId) return
    await api.characters.update(novelId, charId, profile).catch(console.error)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  async function handleDeleteChar(charId: string, name: string) {
    if (!novelId) return
    if (!window.confirm(`确定删除角色「${name}」？`)) return
    await api.characters.delete(novelId, charId).catch(console.error)
    setCharacters(prev => prev.filter(c => c.id !== charId))
    setCharProfiles(prev => { const n = { ...prev }; delete n[charId]; return n })
  }

  const inputCls = "w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const title = novel?.title ?? '…'

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="settings">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-xl font-bold text-slate-100">设定与角色</h1>

        {/* World Bible */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">世界观 / 故事圣经</h2>
          <textarea
            className={`${inputCls} h-40 resize-none`}
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </section>

        {/* Auto generation */}
        <section className="bg-surface border border-rim rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">自动生成</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4 accent-indigo-500"
            />
            <label htmlFor="autoGen" className="text-sm text-slate-300">开启每日自动生章</label>
          </div>
          {autoGenerate && (
            <div className="flex items-center gap-3 pl-7">
              <label className="text-xs text-slate-500">每天生成时间</label>
              <input
                type="time"
                value={dailyTime}
                onChange={e => setDailyTime(e.target.value)}
                className="bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}
        </section>

        {/* AI Model */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">AI 模型</h2>
          <div className="flex gap-4">
            {(['anthropic', 'deepseek'] as const).map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  checked={provider === p}
                  onChange={() => setProvider(p)}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">{p === 'anthropic' ? 'Claude (Anthropic)' : 'DeepSeek'}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            {provider === 'anthropic' ? '需要 ANTHROPIC_API_KEY，写作质量更高' : '需要 DEEPSEEK_API_KEY，费用约低 10 倍'}
          </p>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
            disabled={saving}
            onClick={handleSaveAll}
          >
            保存设定
          </button>
          {status && (
            <span className={`text-sm ${status.includes('失败') ? 'text-red-400' : 'text-emerald-400'}`}>{status}</span>
          )}
        </div>

        {/* Characters */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">角色档案</h2>
          {characters.map(c => (
            <div key={c.id} className="bg-surface border border-rim rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{c.name}</span>
                <button
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                  onClick={() => handleDeleteChar(c.id, c.name).catch(console.error)}
                >
                  删除
                </button>
              </div>
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={charProfiles[c.id] ?? c.profile}
                onChange={e => setCharProfiles(prev => ({ ...prev, [c.id]: e.target.value }))}
                onBlur={e => handleUpdateChar(c.id, e.target.value).catch(console.error)}
              />
            </div>
          ))}

          {/* Add new character */}
          <div className="bg-surface border border-rim rounded-xl p-4 space-y-3">
            <p className="text-sm text-slate-500">添加新角色</p>
            <input
              className={inputCls}
              placeholder="角色名"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
            />
            <textarea
              className={`${inputCls} h-20 resize-none`}
              placeholder="角色档案描述"
              value={newCharProfile}
              onChange={e => setNewCharProfile(e.target.value)}
            />
            <button
              className="bg-surface-hover border border-rim text-slate-300 px-3 py-1.5 rounded-lg text-sm hover:border-indigo-500/50 disabled:opacity-40 transition-colors"
              disabled={!newCharName || !newCharProfile || saving}
              onClick={() => handleAddCharacter().catch(console.error)}
            >
              添加
            </button>
          </div>
        </section>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add frontend/src/pages/NovelSettings.tsx
git commit -m "feat: dark Settings page with character management"
```

---

## Task 11: Cleanup — Delete Old Pages

**Files:**
- Delete: `frontend/src/pages/NovelCreate.tsx`
- Delete: `frontend/src/pages/NovelDetail.tsx`

These files are no longer imported by App.tsx (removed in Task 6) so deleting them won't break the build.

- [ ] **Step 1: Delete the files**

```bash
rm /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend/src/pages/NovelCreate.tsx
rm /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend/src/pages/NovelDetail.tsx
```

- [ ] **Step 2: Final build**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent/frontend && npm run build 2>&1 | tail -20
```

Expected: clean build, 0 errors.

- [ ] **Step 3: Final commit**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
git add -A
git commit -m "feat: remove NovelCreate and NovelDetail pages (replaced by modal + redirect)"
```
