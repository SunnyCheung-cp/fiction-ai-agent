# Fiction AI Agent v2 — Design Spec

**Date:** 2026-05-20  
**Scope:** Full UI revamp (Dashboard + novel/chapter management pages) + auto daily chapter generation scheduler. Publishing platform integration deferred to v3.

---

## Goals

1. Replace the minimal write-only UI with a proper management interface: dashboard, novel list, novel detail, chapter list, chapter detail, novel settings.
2. Add an auto-scheduler so each novel can generate one chapter per day at a configured time without manual intervention.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  FastAPI Backend                                         │
│                                                          │
│  Existing: database.py, vector_store.py,                │
│            novel_engine.py, memory_manager.py           │
│                                                          │
│  New:  backend/scheduler.py  ← APScheduler              │
│        backend/main.py       ← extend with new routes   │
│        backend/models.py     ← extend models            │
│        backend/database.py   ← migration + new methods  │
└────────────────────────────┬────────────────────────────┘
                             │ REST / SSE
┌────────────────────────────▼────────────────────────────┐
│  React Frontend (Vite + Tailwind + react-router-dom)     │
│                                                          │
│  Layout: top navbar with breadcrumb navigation           │
│                                                          │
│  / (Dashboard)                                           │
│  /novels (Novel List)                                    │
│  /novels/:id (Novel Detail)                              │
│  /novels/:id/chapters (Chapter List)                     │
│  /novels/:id/chapters/:num (Chapter Detail)              │
│  /novels/:id/settings (Novel Settings — world+chars)     │
│  /novels/:id/outline (Outline Editor — existing)         │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Changes

### 1. Database Migration

Add two columns to the `novels` table:

```sql
ALTER TABLE novels ADD COLUMN auto_generate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE novels ADD COLUMN daily_time TEXT NOT NULL DEFAULT '08:00';
```

`initialize()` in `database.py` uses `CREATE TABLE IF NOT EXISTS`, so migration must be handled separately. A `migrate()` method will run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (implemented via try/except since SQLite doesn't support `IF NOT EXISTS` on ALTER).

New `Database` methods:
- `set_auto_generate(novel_id, enabled: bool, daily_time: str)` — update both fields atomically
- `list_auto_generate_novels()` → list of dicts with `id`, `title`, `daily_time` for all novels where `auto_generate=1`
- `get_next_chapter_num(novel_id)` → int: max(chapter_num)+1 from chapters table, defaulting to 1

### 2. Models

Extend `NovelResponse`:
```python
auto_generate: bool
daily_time: str  # "HH:MM" 24-hour format
```

Extend `NovelUpdate`:
```python
world_bible: Optional[str] = None
auto_generate: Optional[bool] = None
daily_time: Optional[str] = None  # validated: "HH:MM" pattern
```

New request model:
```python
class NovelCreate(BaseModel):
    title: str
    world_bible: str = ""
    auto_generate: bool = False
    daily_time: str = "08:00"
```

### 3. Scheduler (`backend/scheduler.py`)

Uses APScheduler's `AsyncIOScheduler`. Embedded in FastAPI's `lifespan`.

**Responsibilities:**
- On startup: load all novels with `auto_generate=True` and schedule a daily job for each
- `schedule_novel(novel_id, daily_time)` — add/replace a cron job for that novel
- `unschedule_novel(novel_id)` — remove the job
- `generate_next_chapter(novel_id, db)` — the job function: find next chapter num, build context, run generation, save content, run `after_chapter_written` background

Job ID convention: `auto_gen_{novel_id}`  
Cron expression: `hour=HH, minute=MM` from daily_time string.

**Error handling:** Exceptions in the scheduled job are caught and logged; they do not crash the scheduler.

### 4. API Changes (`backend/main.py`)

Modified endpoints:
- `POST /api/novels` — accepts new fields (auto_generate, daily_time); schedules job if auto_generate=True
- `PUT /api/novels/:id` — partial update; reschedules/unschedules as needed

New endpoints:
- `GET /api/novels/:id/chapters` — list all chapters (num, content length, summary, has_content bool)
- `GET /api/stats` — dashboard stats: novel count, total chapters written, auto-gen enabled count, last 5 generated chapters

Response model for chapter list item:
```python
class ChapterListItem(BaseModel):
    novel_id: str
    chapter_num: int
    word_count: int
    has_content: bool
    summary: str
```

---

## Frontend Changes

### Layout: `frontend/src/components/Layout.tsx`

A shared wrapper with:
- Top navbar: app name "AI 小说工坊", breadcrumb trail based on current route
- Main content area (children)

All pages use `<Layout>`. No sidebar — keeps it clean.

### New/Modified Pages

#### Dashboard (`/`)
- Stats row: 4 cards — 小说总数, 已写章节, 自动生成中, 今日已生成
- Recent activity list: last 10 generated chapters (novel title + chapter num + time)
- "新建小说" button → `/novels/new`

#### Novel List (`/novels`)
- Grid of novel cards: title, chapter count, auto-gen badge (green = on, gray = off)
- Each card links to `/novels/:id`
- "新建小说" button

#### Novel Create (`/novels/new`)
- Simplified form: title, world bible, auto_generate toggle, daily_time input (shown when toggle on)
- Submits → redirects to `/novels/:id`

#### Novel Detail (`/novels/:id`)
- Header: novel title + status badge
- 4 quick-stat chips: characters count, outlines count, chapters written, auto-gen status
- Navigation tabs/buttons to: 章节列表, 大纲, 设定
- Character cards (name + profile preview, read-only; click → settings to edit)

#### Chapter List (`/novels/:id/chapters`)
- Table: chapter num | word count | summary (truncated 60 chars) | status badge | actions
- Status badge: ✅ 已写 / ⚪ 未写
- Actions per row: 查看, 生成 (if not written), 重新生成 (if written)
- "生成下一章" button at top (generates next unwritten chapter with live streaming feedback)

#### Chapter Detail (`/novels/:id/chapters/:num`)
- Header: 第N章 + novel title breadcrumb
- Read-only content display (pre-formatted, scrollable)
- Summary section
- Word count + generation timestamp
- "重新生成" button → triggers SSE streaming, replaces content live
- "编辑" toggle → makes content textarea editable with save button
- Prev/Next chapter navigation

#### Novel Settings (`/novels/:id/settings`)
- World Bible section (textarea + save)
- Characters section (list + add new — same as existing Setup page)
- Auto Generation section:
  - Toggle: 开启每日自动生章
  - Time picker input (24h): 每天生成时间
  - Save button

---

## Data Flow: Auto Generation

```
FastAPI lifespan start
  → db.list_auto_generate_novels()
  → for each novel: scheduler.schedule_novel(novel_id, daily_time)

Daily cron fires for novel X:
  → db.get_next_chapter_num(novel_id)
  → mm.build_context(chapter_num, db)
  → async for chunk in engine.generate_chapter_stream(context): accumulate
  → db.save_chapter_content(novel_id, chapter_num, full_text)
  → mm.after_chapter_written(chapter_num, full_text, db)  ← summary + vector update
```

When user toggles auto_generate:
```
PUT /api/novels/:id { auto_generate: true, daily_time: "09:00" }
  → db.set_auto_generate(novel_id, True, "09:00")
  → scheduler.schedule_novel(novel_id, "09:00")   ← adds/replaces cron job
  → return updated novel
```

---

## File Structure (changes only)

```
backend/
  scheduler.py          ← NEW
  models.py             ← extend Novel* models + ChapterListItem
  database.py           ← migrate() + new methods
  main.py               ← new endpoints + scheduler wiring

frontend/src/
  components/
    Layout.tsx          ← NEW: shared navbar + breadcrumb
  pages/
    Dashboard.tsx       ← NEW (replaces Home.tsx)
    NovelList.tsx       ← NEW
    NovelCreate.tsx     ← NEW
    NovelDetail.tsx     ← NEW
    ChapterList.tsx     ← NEW
    ChapterDetail.tsx   ← NEW
    NovelSettings.tsx   ← replaces Setup.tsx logic
  api/
    client.ts           ← extend: chapters.list, novels.stats, chapters.generateStream reuse
    types.ts            ← extend: NovelResponse, ChapterListItem, Stats
  App.tsx               ← new routes
```

---

## Dependencies

New Python dependency: `apscheduler==3.10.4` (add to requirements.txt)

---

## Non-Goals (this version)

- Publishing to external platforms (deferred to v3)
- Multi-user / auth
- Chapter ordering / reordering UI
- Export to EPUB/PDF
