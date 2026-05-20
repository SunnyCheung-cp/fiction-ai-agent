# Fiction AI Agent v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full management UI (dashboard, novel/chapter pages) and an APScheduler-based auto daily chapter generation system.

**Architecture:** Backend gains a scheduler module (APScheduler AsyncIOScheduler) embedded in FastAPI lifespan, two new DB columns, three new endpoints. Frontend replaces the minimal write-only UI with a multi-page management app using a shared Layout component and react-router-dom routes.

**Tech Stack:** Python 3.12, FastAPI 0.115, APScheduler 3.10.4, SQLite, Anthropic SDK; React 18, TypeScript, Vite, Tailwind CSS, react-router-dom 7

---

## File Structure

```
backend/
  scheduler.py          NEW  — AsyncIOScheduler wrapper, schedule_novel/unschedule_novel, generate_next_chapter job
  models.py             MOD  — extend Novel* models, add ChapterListItem, StatsResponse
  database.py           MOD  — migrate(), set_auto_generate, list_auto_generate_novels, get_next_chapter_num, list_chapters_with_status, get_stats
  main.py               MOD  — new GET /api/novels/:id/chapters, GET /api/stats, updated PUT /api/novels/:id, scheduler wiring

frontend/src/
  components/
    Layout.tsx          NEW  — shared top navbar + breadcrumb + main content wrapper
  pages/
    Dashboard.tsx       NEW  — stats cards + recent activity (replaces Home.tsx)
    NovelList.tsx       NEW  — novel grid with status badges
    NovelCreate.tsx     NEW  — create novel form with auto-gen toggle
    NovelDetail.tsx     NEW  — novel overview: stats, characters, nav buttons
    ChapterList.tsx     NEW  — chapter table with status + inline generate
    ChapterDetail.tsx   NEW  — chapter content viewer/editor + SSE regenerate
    NovelSettings.tsx   NEW  — world bible + characters + auto-gen settings (replaces Setup.tsx)
    Outline.tsx         KEEP — reused at /novels/:id/outline (no changes)
  api/
    types.ts            MOD  — extend Novel, add ChapterListItem, Stats
    client.ts           MOD  — extend novels.update signature, add chapters.list, api.stats.get
  App.tsx               MOD  — replace routes with new URL structure

requirements.txt        MOD  — add apscheduler==3.10.4
tests/
  test_database.py      MOD  — add tests for new DB methods
  test_scheduler.py     NEW  — test scheduler job function + error handling
```

---

## Task 1: Database — Migration and New Methods

**Files:**
- Modify: `backend/database.py`
- Modify: `tests/test_database.py`

- [ ] **Step 1: Add failing tests for new DB methods**

Append to `tests/test_database.py`:

```python
# --- v2 additions ---

def test_migrate_adds_columns(db):
    novel_id = db.create_novel("仙侠传")
    novel = db.get_novel(novel_id)
    assert "auto_generate" in novel
    assert "daily_time" in novel
    assert novel["auto_generate"] == 0
    assert novel["daily_time"] == "08:00"

def test_set_auto_generate(db):
    novel_id = db.create_novel("仙侠传")
    db.set_auto_generate(novel_id, True, "09:30")
    novel = db.get_novel(novel_id)
    assert novel["auto_generate"] == 1
    assert novel["daily_time"] == "09:30"

def test_set_auto_generate_disable(db):
    novel_id = db.create_novel("仙侠传")
    db.set_auto_generate(novel_id, True, "08:00")
    db.set_auto_generate(novel_id, False, "08:00")
    assert db.get_novel(novel_id)["auto_generate"] == 0

def test_list_auto_generate_novels(db):
    id1 = db.create_novel("小说A")
    db.create_novel("小说B")
    db.set_auto_generate(id1, True, "08:00")
    result = db.list_auto_generate_novels()
    assert len(result) == 1
    assert result[0]["id"] == id1
    assert result[0]["daily_time"] == "08:00"

def test_get_next_chapter_num_empty(db):
    novel_id = db.create_novel("仙侠传")
    assert db.get_next_chapter_num(novel_id) == 1

def test_get_next_chapter_num_with_chapters(db):
    novel_id = db.create_novel("仙侠传")
    db.save_chapter_content(novel_id, 1, "第一章")
    db.save_chapter_content(novel_id, 3, "第三章")
    assert db.get_next_chapter_num(novel_id) == 4

def test_list_chapters_with_status_mixed(db):
    novel_id = db.create_novel("仙侠传")
    db.upsert_outline(novel_id, 1, "第一章大纲")
    db.upsert_outline(novel_id, 2, "第二章大纲")
    db.save_chapter_content(novel_id, 1, "第一章正文内容")
    rows = db.list_chapters_with_status(novel_id)
    assert len(rows) == 2
    ch1 = next(r for r in rows if r["chapter_num"] == 1)
    ch2 = next(r for r in rows if r["chapter_num"] == 2)
    assert ch1["has_content"] is True
    assert ch1["word_count"] == len("第一章正文内容")
    assert ch2["has_content"] is False
    assert ch2["word_count"] == 0

def test_get_stats(db):
    id1 = db.create_novel("小说A")
    db.create_novel("小说B")
    db.set_auto_generate(id1, True, "08:00")
    db.save_chapter_content(id1, 1, "第一章内容")
    stats = db.get_stats()
    assert stats["novel_count"] == 2
    assert stats["total_chapters"] == 1
    assert stats["auto_gen_count"] == 1
    assert len(stats["recent_chapters"]) == 1
    assert stats["recent_chapters"][0]["chapter_num"] == 1
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
source .venv/bin/activate && pytest tests/test_database.py -k "migrate or auto_generate or next_chapter or list_chapters or get_stats" -v
```

Expected: FAIL (methods not yet defined).

- [ ] **Step 3: Implement new DB methods in `backend/database.py`**

Add `migrate()` call inside `initialize()`, then add all new methods.

In `initialize()`, add this line at the very end (after `executescript`):

```python
    def initialize(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS novels (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    world_bible TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS characters (
                    id TEXT PRIMARY KEY,
                    novel_id TEXT NOT NULL REFERENCES novels(id),
                    name TEXT NOT NULL,
                    profile TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS chapter_outlines (
                    novel_id TEXT NOT NULL REFERENCES novels(id),
                    chapter_num INTEGER NOT NULL,
                    outline TEXT NOT NULL,
                    PRIMARY KEY (novel_id, chapter_num)
                );
                CREATE TABLE IF NOT EXISTS chapters (
                    novel_id TEXT NOT NULL REFERENCES novels(id),
                    chapter_num INTEGER NOT NULL,
                    content TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now')),
                    PRIMARY KEY (novel_id, chapter_num)
                );
            """)
        self.migrate()
```

Then add these methods to the `Database` class (after `get_recent_summaries`):

```python
    def migrate(self):
        """Add new columns to existing tables; safe to run on fresh DBs."""
        migrations = [
            ("novels", "auto_generate", "INTEGER NOT NULL DEFAULT 0"),
            ("novels", "daily_time", "TEXT NOT NULL DEFAULT '08:00'"),
        ]
        with self._conn() as conn:
            for table, col, definition in migrations:
                try:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
                except Exception:
                    pass  # column already exists

    def set_auto_generate(self, novel_id: str, enabled: bool, daily_time: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE novels SET auto_generate = ?, daily_time = ? WHERE id = ?",
                (1 if enabled else 0, daily_time, novel_id)
            )

    def list_auto_generate_novels(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, title, daily_time FROM novels WHERE auto_generate = 1"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_next_chapter_num(self, novel_id: str) -> int:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT MAX(chapter_num) FROM chapters WHERE novel_id = ?",
                (novel_id,)
            ).fetchone()
        return (row[0] or 0) + 1

    def list_chapters_with_status(self, novel_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute("""
                SELECT chapter_num, content, summary
                FROM chapters WHERE novel_id = ?
                UNION
                SELECT chapter_num, '' as content, '' as summary
                FROM chapter_outlines
                WHERE novel_id = ? AND chapter_num NOT IN (
                    SELECT chapter_num FROM chapters WHERE novel_id = ?
                )
                ORDER BY chapter_num
            """, (novel_id, novel_id, novel_id)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            content = d.get("content", "") or ""
            d["has_content"] = bool(content)
            d["word_count"] = len(content)
            result.append(d)
        return result

    def get_stats(self) -> dict:
        with self._conn() as conn:
            novel_count = conn.execute("SELECT COUNT(*) FROM novels").fetchone()[0]
            total_chapters = conn.execute(
                "SELECT COUNT(*) FROM chapters WHERE content != ''"
            ).fetchone()[0]
            auto_gen_count = conn.execute(
                "SELECT COUNT(*) FROM novels WHERE auto_generate = 1"
            ).fetchone()[0]
            recent = conn.execute("""
                SELECT c.novel_id, n.title as novel_title, c.chapter_num, c.created_at
                FROM chapters c JOIN novels n ON c.novel_id = n.id
                WHERE c.content != ''
                ORDER BY c.created_at DESC LIMIT 10
            """).fetchall()
        return {
            "novel_count": novel_count,
            "total_chapters": total_chapters,
            "auto_gen_count": auto_gen_count,
            "recent_chapters": [dict(r) for r in recent],
        }
```

- [ ] **Step 4: Run all database tests — expect all PASS**

```bash
pytest tests/test_database.py -v
```

Expected: all tests PASS (original 9 + new 8 = 17 tests).

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pytest tests/ -v
```

Expected: all 23 existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/database.py tests/test_database.py
git commit -m "feat: DB migration, auto-generate columns, stats and chapter-status methods"
```

---

## Task 2: Models and Requirements

**Files:**
- Modify: `backend/models.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add apscheduler to requirements.txt**

Add this line to `requirements.txt`:

```
apscheduler==3.10.4
```

- [ ] **Step 2: Install it**

```bash
source .venv/bin/activate && pip install apscheduler==3.10.4
```

Expected: installs without error.

- [ ] **Step 3: Replace backend/models.py with extended version**

```python
# backend/models.py
from pydantic import BaseModel
from typing import Optional

class NovelCreate(BaseModel):
    title: str
    world_bible: str = ""
    auto_generate: bool = False
    daily_time: str = "08:00"

class NovelUpdate(BaseModel):
    world_bible: Optional[str] = None
    auto_generate: Optional[bool] = None
    daily_time: Optional[str] = None

class NovelResponse(BaseModel):
    id: str
    title: str
    world_bible: str
    created_at: str
    auto_generate: bool
    daily_time: str

class CharacterCreate(BaseModel):
    name: str
    profile: str

class CharacterResponse(BaseModel):
    id: str
    novel_id: str
    name: str
    profile: str

class CharacterUpdate(BaseModel):
    profile: str

class OutlineUpsert(BaseModel):
    chapter_num: int
    outline: str

class OutlineResponse(BaseModel):
    novel_id: str
    chapter_num: int
    outline: str

class ChapterResponse(BaseModel):
    novel_id: str
    chapter_num: int
    content: str
    summary: str

class ChapterUpdate(BaseModel):
    content: str

class ChapterListItem(BaseModel):
    novel_id: str
    chapter_num: int
    word_count: int
    has_content: bool
    summary: str

class RecentChapter(BaseModel):
    novel_id: str
    novel_title: str
    chapter_num: int
    created_at: str

class StatsResponse(BaseModel):
    novel_count: int
    total_chapters: int
    auto_gen_count: int
    recent_chapters: list[RecentChapter]
```

- [ ] **Step 4: Run full test suite — expect all PASS**

```bash
pytest tests/ -v
```

Expected: all 23 tests PASS (models change is additive).

- [ ] **Step 5: Commit**

```bash
git add backend/models.py requirements.txt
git commit -m "feat: extend models with auto_generate fields, ChapterListItem, StatsResponse; add apscheduler dep"
```

---

## Task 3: Scheduler Module

**Files:**
- Create: `backend/scheduler.py`
- Create: `tests/test_scheduler.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_scheduler.py
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.scheduler import schedule_novel, unschedule_novel, generate_next_chapter, scheduler


def test_schedule_novel_adds_job():
    schedule_novel("novel-123", "08:30")
    job = scheduler.get_job("auto_gen_novel-123")
    assert job is not None
    scheduler.remove_job("auto_gen_novel-123")


def test_schedule_novel_replaces_existing():
    schedule_novel("novel-abc", "08:00")
    schedule_novel("novel-abc", "10:00")
    jobs = [j for j in scheduler.get_jobs() if j.id == "auto_gen_novel-abc"]
    assert len(jobs) == 1
    scheduler.remove_job("auto_gen_novel-abc")


def test_unschedule_novel_removes_job():
    schedule_novel("novel-xyz", "09:00")
    unschedule_novel("novel-xyz")
    assert scheduler.get_job("auto_gen_novel-xyz") is None


def test_unschedule_nonexistent_does_not_raise():
    unschedule_novel("novel-does-not-exist")  # must not raise


@pytest.mark.asyncio
async def test_generate_next_chapter_calls_pipeline():
    mock_db = MagicMock()
    mock_db.get_next_chapter_num.return_value = 5
    mock_db.get_novel.return_value = {"id": "n1", "title": "T"}

    async def fake_stream(ctx):
        yield "chunk1"
        yield "chunk2"

    mock_mm = MagicMock()
    mock_mm.build_context.return_value = "context"
    mock_mm.engine.generate_chapter_stream = fake_stream
    mock_mm.after_chapter_written = AsyncMock()

    with patch("backend.scheduler.Database", return_value=mock_db), \
         patch("backend.scheduler.MemoryManager", return_value=mock_mm):
        await generate_next_chapter("n1")

    mock_db.save_chapter_content.assert_called_once_with("n1", 5, "chunk1chunk2")
    mock_mm.after_chapter_written.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_next_chapter_handles_exception():
    mock_db = MagicMock()
    mock_db.get_next_chapter_num.side_effect = Exception("DB error")
    with patch("backend.scheduler.Database", return_value=mock_db):
        await generate_next_chapter("bad-novel")  # must not raise
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_scheduler.py -v
```

Expected: ImportError for `backend.scheduler`.

- [ ] **Step 3: Create backend/scheduler.py**

```python
# backend/scheduler.py
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database import Database
from backend.memory_manager import MemoryManager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def schedule_novel(novel_id: str, daily_time: str):
    hour, minute = map(int, daily_time.split(":"))
    scheduler.add_job(
        generate_next_chapter,
        CronTrigger(hour=hour, minute=minute),
        id=f"auto_gen_{novel_id}",
        args=[novel_id],
        replace_existing=True,
    )


def unschedule_novel(novel_id: str):
    job_id = f"auto_gen_{novel_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


async def generate_next_chapter(novel_id: str):
    try:
        db = Database("data/novel.db")
        chapter_num = db.get_next_chapter_num(novel_id)
        mm = MemoryManager(novel_id=novel_id)
        context = mm.build_context(chapter_num=chapter_num, db=db)
        full_text = ""
        async for chunk in mm.engine.generate_chapter_stream(context):
            full_text += chunk
        db.save_chapter_content(novel_id, chapter_num, full_text)
        await mm.after_chapter_written(chapter_num=chapter_num, content=full_text, db=db)
        logger.info("Auto-generated chapter %d for novel %s", chapter_num, novel_id)
    except Exception as exc:
        logger.error("Auto-generation failed for novel %s: %s", novel_id, exc)
```

- [ ] **Step 4: Run scheduler tests — expect all PASS**

```bash
pytest tests/test_scheduler.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v
```

Expected: all 29 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/scheduler.py tests/test_scheduler.py
git commit -m "feat: APScheduler module with schedule/unschedule/generate_next_chapter"
```

---

## Task 4: API Updates

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Replace backend/main.py with the updated version**

```python
# backend/main.py
import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.database import Database
from backend.memory_manager import MemoryManager
from backend import scheduler as scheduler_module
from backend.scheduler import scheduler as _scheduler
from backend.models import (
    NovelCreate, NovelUpdate, NovelResponse,
    CharacterCreate, CharacterUpdate, CharacterResponse,
    OutlineUpsert, OutlineResponse,
    ChapterResponse, ChapterUpdate, ChapterListItem, StatsResponse,
)
from dotenv import load_dotenv

load_dotenv()

_db: Database | None = None


def get_db() -> Database:
    return _db


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db
    os.makedirs("data", exist_ok=True)
    _db = Database("data/novel.db")
    _db.initialize()
    _scheduler.start()
    for novel in _db.list_auto_generate_novels():
        scheduler_module.schedule_novel(novel["id"], novel["daily_time"])
    yield
    _scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB = Annotated[Database, Depends(get_db)]

# --- Stats ---

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: DB):
    return db.get_stats()

# --- Novels ---

@app.post("/api/novels", response_model=NovelResponse)
def create_novel(body: NovelCreate, db: DB):
    novel_id = db.create_novel(body.title, body.world_bible)
    if body.auto_generate:
        db.set_auto_generate(novel_id, True, body.daily_time)
        scheduler_module.schedule_novel(novel_id, body.daily_time)
    return db.get_novel(novel_id)

@app.get("/api/novels", response_model=list[NovelResponse])
def list_novels(db: DB):
    return db.list_novels()

@app.get("/api/novels/{novel_id}", response_model=NovelResponse)
def get_novel(novel_id: str, db: DB):
    novel = db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    return novel

@app.put("/api/novels/{novel_id}", response_model=NovelResponse)
def update_novel(novel_id: str, body: NovelUpdate, db: DB):
    novel = db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    if body.world_bible is not None:
        db.update_world_bible(novel_id, body.world_bible)
    if body.auto_generate is not None or body.daily_time is not None:
        enabled = body.auto_generate if body.auto_generate is not None else bool(novel["auto_generate"])
        time = body.daily_time if body.daily_time is not None else novel["daily_time"]
        db.set_auto_generate(novel_id, enabled, time)
        if enabled:
            scheduler_module.schedule_novel(novel_id, time)
        else:
            scheduler_module.unschedule_novel(novel_id)
    return db.get_novel(novel_id)

# --- Characters ---

@app.post("/api/novels/{novel_id}/characters", response_model=CharacterResponse)
def create_character(novel_id: str, body: CharacterCreate, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    char_id = db.create_character(novel_id, body.name, body.profile)
    char = next((c for c in db.get_characters(novel_id) if c["id"] == char_id), None)
    if not char:
        raise HTTPException(status_code=500, detail="Character creation failed")
    return char

@app.get("/api/novels/{novel_id}/characters", response_model=list[CharacterResponse])
def list_characters(novel_id: str, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    return db.get_characters(novel_id)

@app.put("/api/novels/{novel_id}/characters/{char_id}", response_model=CharacterResponse)
def update_character(novel_id: str, char_id: str, body: CharacterUpdate, db: DB):
    chars = db.get_characters(novel_id)
    char = next((c for c in chars if c["id"] == char_id), None)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    db.update_character(char_id, body.profile)
    return {**char, "profile": body.profile}

# --- Outlines ---

@app.post("/api/novels/{novel_id}/outlines", response_model=OutlineResponse)
def upsert_outline(novel_id: str, body: OutlineUpsert, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    db.upsert_outline(novel_id, body.chapter_num, body.outline)
    outlines = db.get_outlines(novel_id)
    outline = next((o for o in outlines if o["chapter_num"] == body.chapter_num), None)
    if not outline:
        raise HTTPException(status_code=500, detail="Outline upsert failed")
    return outline

@app.get("/api/novels/{novel_id}/outlines", response_model=list[OutlineResponse])
def list_outlines(novel_id: str, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    return db.get_outlines(novel_id)

# --- Chapters ---

@app.get("/api/novels/{novel_id}/chapters", response_model=list[ChapterListItem])
def list_chapters(novel_id: str, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    rows = db.list_chapters_with_status(novel_id)
    return [
        {"novel_id": novel_id, "chapter_num": r["chapter_num"],
         "word_count": r["word_count"], "has_content": r["has_content"],
         "summary": r.get("summary", "")}
        for r in rows
    ]

@app.get("/api/novels/{novel_id}/chapters/{chapter_num}", response_model=ChapterResponse)
def get_chapter(novel_id: str, chapter_num: int, db: DB):
    return db.get_chapter(novel_id, chapter_num)

@app.put("/api/novels/{novel_id}/chapters/{chapter_num}", response_model=ChapterResponse)
def update_chapter(novel_id: str, chapter_num: int, body: ChapterUpdate, db: DB):
    db.save_chapter_content(novel_id, chapter_num, body.content)
    return db.get_chapter(novel_id, chapter_num)

@app.post("/api/novels/{novel_id}/chapters/{chapter_num}/generate")
async def generate_chapter(novel_id: str, chapter_num: int, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")

    mm = MemoryManager(novel_id=novel_id)
    context = mm.build_context(chapter_num=chapter_num, db=db)

    async def event_stream():
        full_text = ""
        try:
            async for chunk in mm.engine.generate_chapter_stream(context):
                full_text += chunk
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        await asyncio.to_thread(db.save_chapter_content, novel_id, chapter_num, full_text)
        asyncio.create_task(
            mm.after_chapter_written(chapter_num=chapter_num, content=full_text, db=db)
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 2: Run full test suite**

```bash
source .venv/bin/activate && pytest tests/ -v
```

Expected: all 29 tests PASS.

- [ ] **Step 3: Quick smoke test — start server and hit stats endpoint**

```bash
ANTHROPIC_API_KEY=test uvicorn backend.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/api/stats | python3 -m json.tool
kill %1
```

Expected: JSON with `novel_count`, `total_chapters`, `auto_gen_count`, `recent_chapters`.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add /api/stats, /api/novels/:id/chapters, extend PUT /api/novels with auto_generate, wire scheduler"
```

---

## Task 5: Frontend Types and API Client Extension

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Replace frontend/src/api/types.ts**

```typescript
// frontend/src/api/types.ts
export interface Novel {
  id: string
  title: string
  world_bible: string
  created_at: string
  auto_generate: boolean
  daily_time: string
}

export interface Character {
  id: string
  novel_id: string
  name: string
  profile: string
}

export interface Outline {
  novel_id: string
  chapter_num: number
  outline: string
}

export interface Chapter {
  novel_id: string
  chapter_num: number
  content: string
  summary: string
}

export interface ChapterListItem {
  novel_id: string
  chapter_num: number
  word_count: number
  has_content: boolean
  summary: string
}

export interface RecentChapter {
  novel_id: string
  novel_title: string
  chapter_num: number
  created_at: string
}

export interface Stats {
  novel_count: number
  total_chapters: number
  auto_gen_count: number
  recent_chapters: RecentChapter[]
}
```

- [ ] **Step 2: Replace frontend/src/api/client.ts**

```typescript
// frontend/src/api/client.ts
import type { Novel, Character, Outline, Chapter, ChapterListItem, Stats } from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  stats: {
    get: () => req<Stats>('/stats'),
  },
  novels: {
    list: () => req<Novel[]>('/novels'),
    get: (id: string) => req<Novel>(`/novels/${id}`),
    create: (body: { title: string; world_bible?: string; auto_generate?: boolean; daily_time?: string }) =>
      req<Novel>('/novels', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { world_bible?: string; auto_generate?: boolean; daily_time?: string }) =>
      req<Novel>(`/novels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  characters: {
    list: (novelId: string) => req<Character[]>(`/novels/${novelId}/characters`),
    create: (novelId: string, name: string, profile: string) =>
      req<Character>(`/novels/${novelId}/characters`, {
        method: 'POST',
        body: JSON.stringify({ name, profile }),
      }),
    update: (novelId: string, charId: string, profile: string) =>
      req<Character>(`/novels/${novelId}/characters/${charId}`, {
        method: 'PUT',
        body: JSON.stringify({ profile }),
      }),
  },
  outlines: {
    list: (novelId: string) => req<Outline[]>(`/novels/${novelId}/outlines`),
    upsert: (novelId: string, chapter_num: number, outline: string) =>
      req<Outline>(`/novels/${novelId}/outlines`, {
        method: 'POST',
        body: JSON.stringify({ chapter_num, outline }),
      }),
  },
  chapters: {
    list: (novelId: string) => req<ChapterListItem[]>(`/novels/${novelId}/chapters`),
    get: (novelId: string, num: number) => req<Chapter>(`/novels/${novelId}/chapters/${num}`),
    update: (novelId: string, num: number, content: string) =>
      req<Chapter>(`/novels/${novelId}/chapters/${num}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    generateStream: async (
      novelId: string,
      num: number,
      onChunk: (text: string) => void,
      onDone: () => void,
      onError: (err: string) => void
    ) => {
      const res = await fetch(`${BASE}/novels/${novelId}/chapters/${num}/generate`, {
        method: 'POST',
      })
      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError(parsed.error); return }
            if (parsed.text) onChunk(parsed.text)
          } catch (e) {
            console.warn('SSE parse error', e, payload)
          }
        }
      }
      onDone()
    },
  },
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

Expected: `TS OK`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts
git commit -m "feat: extend API types and client with ChapterListItem, Stats, auto_generate fields"
```

---

## Task 6: Layout Component and App Routing

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create frontend/src/components/Layout.tsx**

```tsx
// frontend/src/components/Layout.tsx
import { useNavigate } from 'react-router-dom'

interface Breadcrumb {
  label: string
  href?: string
}

interface LayoutProps {
  breadcrumbs?: Breadcrumb[]
  children: React.ReactNode
}

export default function Layout({ breadcrumbs = [], children }: LayoutProps) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-2 text-sm">
        <button
          className="font-bold text-blue-600 hover:underline"
          onClick={() => navigate('/')}
        >
          AI 小说工坊
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {crumb.href ? (
              <button
                className="text-blue-600 hover:underline"
                onClick={() => navigate(crumb.href!)}
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-gray-600">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <main className="max-w-5xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Replace frontend/src/App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NovelList from './pages/NovelList'
import NovelCreate from './pages/NovelCreate'
import NovelDetail from './pages/NovelDetail'
import ChapterList from './pages/ChapterList'
import ChapterDetail from './pages/ChapterDetail'
import NovelSettings from './pages/NovelSettings'
import OutlinePage from './pages/Outline'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/novels" element={<NovelList />} />
        <Route path="/novels/new" element={<NovelCreate />} />
        <Route path="/novels/:novelId" element={<NovelDetail />} />
        <Route path="/novels/:novelId/chapters" element={<ChapterList />} />
        <Route path="/novels/:novelId/chapters/:num" element={<ChapterDetail />} />
        <Route path="/novels/:novelId/settings" element={<NovelSettings />} />
        <Route path="/novels/:novelId/outline" element={<OutlinePage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only for missing page files (Dashboard, NovelList, etc.) — that's fine, they'll be created in later tasks.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat: Layout component with breadcrumb navbar, updated App routing"
```

---

## Task 7: Dashboard Page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create frontend/src/pages/Dashboard.tsx**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Stats } from '../api/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.stats.get().then(setStats).catch(console.error)
  }, [])

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">控制台</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => navigate('/novels/new')}
          >
            + 新建小说
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="小说总数" value={stats?.novel_count ?? '—'} color="blue" />
          <StatCard label="已写章节" value={stats?.total_chapters ?? '—'} color="green" />
          <StatCard label="自动生成中" value={stats?.auto_gen_count ?? '—'} color="purple" />
        </div>

        {/* Recent chapters */}
        <section>
          <h2 className="text-lg font-semibold mb-3">最近生成</h2>
          {stats?.recent_chapters.length === 0 && (
            <p className="text-gray-400 text-sm">暂无生成记录</p>
          )}
          <div className="space-y-2">
            {stats?.recent_chapters.map((ch, i) => (
              <div
                key={i}
                className="bg-white border rounded p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/novels/${ch.novel_id}/chapters/${ch.chapter_num}`)}
              >
                <div>
                  <span className="font-medium">{ch.novel_title}</span>
                  <span className="text-gray-400 ml-2">第 {ch.chapter_num} 章</span>
                </div>
                <span className="text-xs text-gray-400">{ch.created_at.slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick nav */}
        <section>
          <button
            className="text-blue-600 hover:underline text-sm"
            onClick={() => navigate('/novels')}
          >
            查看全部小说 →
          </button>
        </section>
      </div>
    </Layout>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }
  return (
    <div className={`border rounded p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './pages/" | head -20
```

Expected: no errors about Dashboard.tsx itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: Dashboard with stats cards and recent activity"
```

---

## Task 8: Novel List and Novel Create Pages

**Files:**
- Create: `frontend/src/pages/NovelList.tsx`
- Create: `frontend/src/pages/NovelCreate.tsx`

- [ ] **Step 1: Create frontend/src/pages/NovelList.tsx**

```tsx
// frontend/src/pages/NovelList.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function NovelList() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])

  useEffect(() => {
    api.novels.list().then(setNovels).catch(console.error)
  }, [])

  return (
    <Layout breadcrumbs={[{ label: '小说列表' }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">小说列表</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => navigate('/novels/new')}
          >
            + 新建小说
          </button>
        </div>

        {novels.length === 0 && (
          <p className="text-gray-400">暂无小说，点击「新建小说」开始创作</p>
        )}

        <div className="grid gap-4">
          {novels.map(n => (
            <div
              key={n.id}
              className="bg-white border rounded p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/novels/${n.id}`)}
            >
              <div className="space-y-1">
                <div className="font-semibold text-lg">{n.title}</div>
                <div className="text-sm text-gray-400">{n.created_at?.slice(0, 10)}</div>
              </div>
              <div className="flex items-center gap-3">
                {n.auto_generate ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    每日 {n.daily_time} 自动生成
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                    手动模式
                  </span>
                )}
                <span className="text-gray-400 text-sm">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Create frontend/src/pages/NovelCreate.tsx**

```tsx
// frontend/src/pages/NovelCreate.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'

export default function NovelCreate() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [worldBible, setWorldBible] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const novel = await api.novels.create({
        title,
        world_bible: worldBible,
        auto_generate: autoGenerate,
        daily_time: dailyTime,
      })
      navigate(`/novels/${novel.id}`)
    } catch {
      setError('创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }, { label: '新建小说' }]}>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">新建小说</h1>

        <div className="space-y-2">
          <label className="block font-medium">小说标题 *</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="输入小说名称"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block font-medium">世界观设定</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-32"
            placeholder="描述故事背景、世界规则、核心设定…（可后续编辑）"
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoGen" className="font-medium">开启每日自动生章</label>
          </div>
          {autoGenerate && (
            <div className="flex items-center gap-3 pl-7">
              <label className="text-sm text-gray-600">每天生成时间</label>
              <input
                type="time"
                className="border rounded px-2 py-1"
                value={dailyTime}
                onChange={e => setDailyTime(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
            disabled={!title.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? '创建中…' : '创建小说'}
          </button>
          <button
            className="text-gray-500 px-4 py-2 rounded border hover:bg-gray-50"
            onClick={() => navigate('/novels')}
          >
            取消
          </button>
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './pages/" | head -20
```

Expected: no errors in NovelList.tsx or NovelCreate.tsx.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/NovelList.tsx frontend/src/pages/NovelCreate.tsx
git commit -m "feat: NovelList with status badges, NovelCreate with auto-gen toggle"
```

---

## Task 9: Novel Detail Page

**Files:**
- Create: `frontend/src/pages/NovelDetail.tsx`

- [ ] **Step 1: Create frontend/src/pages/NovelDetail.tsx**

```tsx
// frontend/src/pages/NovelDetail.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Novel, Character } from '../api/types'

export default function NovelDetail() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [chapterCount, setChapterCount] = useState(0)
  const [outlineCount, setOutlineCount] = useState(0)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.characters.list(novelId).then(setCharacters).catch(console.error)
    api.chapters.list(novelId).then(chs => setChapterCount(chs.filter(c => c.has_content).length)).catch(console.error)
    api.outlines.list(novelId).then(os => setOutlineCount(os.length)).catch(console.error)
  }, [novelId])

  if (!novel) {
    return (
      <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }]}>
        <p className="text-gray-400">加载中…</p>
      </Layout>
    )
  }

  return (
    <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }, { label: novel.title }]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{novel.title}</h1>
            <p className="text-sm text-gray-400 mt-1">创建于 {novel.created_at?.slice(0, 10)}</p>
          </div>
          {novel.auto_generate ? (
            <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
              每日 {novel.daily_time} 自动生成
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">手动模式</span>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: '角色', value: characters.length },
            { label: '大纲章节', value: outlineCount },
            { label: '已写章节', value: chapterCount },
            { label: '自动生成', value: novel.auto_generate ? '开启' : '关闭' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded p-3">
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex gap-3 flex-wrap">
          <NavBtn label="章节列表" onClick={() => navigate(`/novels/${novelId}/chapters`)} primary />
          <NavBtn label="章节大纲" onClick={() => navigate(`/novels/${novelId}/outline`)} />
          <NavBtn label="设定" onClick={() => navigate(`/novels/${novelId}/settings`)} />
        </div>

        {/* Characters preview */}
        {characters.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">角色</h2>
            <div className="grid gap-3">
              {characters.map(c => (
                <div key={c.id} className="bg-white border rounded p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-500 mt-1 line-clamp-2">{c.profile}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* World bible preview */}
        {novel.world_bible && (
          <section>
            <h2 className="text-lg font-semibold mb-2">世界观</h2>
            <p className="text-sm text-gray-600 line-clamp-4 bg-white border rounded p-3">
              {novel.world_bible}
            </p>
          </section>
        )}
      </div>
    </Layout>
  )
}

function NavBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      className={`px-5 py-2 rounded font-medium ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border hover:bg-gray-50'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './pages/" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/NovelDetail.tsx
git commit -m "feat: NovelDetail with stats, nav, characters preview"
```

---

## Task 10: Chapter List Page

**Files:**
- Create: `frontend/src/pages/ChapterList.tsx`

- [ ] **Step 1: Create frontend/src/pages/ChapterList.tsx**

```tsx
// frontend/src/pages/ChapterList.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { ChapterListItem, Novel } from '../api/types'

export default function ChapterList() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<ChapterListItem[]>([])
  const [generatingNum, setGeneratingNum] = useState<number | null>(null)
  const [streamStatus, setStreamStatus] = useState('')
  const abortRef = useRef(false)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.chapters.list(novelId).then(setChapters).catch(console.error)
  }, [novelId])

  async function handleGenerate(chapterNum: number) {
    if (!novelId || generatingNum !== null) return
    abortRef.current = false
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

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '章节列表' },
    ]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">章节列表</h1>
          <div className="flex items-center gap-3">
            {streamStatus && (
              <span className={`text-sm ${streamStatus.startsWith('错误') ? 'text-red-600' : 'text-green-600'}`}>
                {streamStatus}
              </span>
            )}
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
              disabled={generatingNum !== null}
              onClick={() => handleGenerate(getNextUnwritten())}
            >
              {generatingNum !== null ? `生成第 ${generatingNum} 章…` : '生成下一章'}
            </button>
          </div>
        </div>

        {chapters.length === 0 && (
          <p className="text-gray-400">暂无章节。请先在「章节大纲」中添加大纲，然后点击「生成下一章」。</p>
        )}

        <table className="w-full border-collapse bg-white rounded border overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b px-4 py-2 text-left w-16">章节</th>
              <th className="border-b px-4 py-2 text-left w-20">状态</th>
              <th className="border-b px-4 py-2 text-left w-20">字数</th>
              <th className="border-b px-4 py-2 text-left">摘要</th>
              <th className="border-b px-4 py-2 text-right w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map(ch => (
              <tr key={ch.chapter_num} className="hover:bg-gray-50">
                <td className="border-b px-4 py-2 font-mono">{ch.chapter_num}</td>
                <td className="border-b px-4 py-2">
                  {ch.has_content ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已写</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">未写</span>
                  )}
                </td>
                <td className="border-b px-4 py-2 text-sm text-gray-500">{ch.word_count > 0 ? ch.word_count : '—'}</td>
                <td className="border-b px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                  {ch.summary || '—'}
                </td>
                <td className="border-b px-4 py-2 text-right space-x-2">
                  {ch.has_content && (
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => navigate(`/novels/${novelId}/chapters/${ch.chapter_num}`)}
                    >
                      查看
                    </button>
                  )}
                  <button
                    className="text-sm text-blue-600 hover:underline disabled:opacity-40"
                    disabled={generatingNum !== null}
                    onClick={() => handleGenerate(ch.chapter_num)}
                  >
                    {ch.has_content ? '重新生成' : '生成'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './pages/" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ChapterList.tsx
git commit -m "feat: ChapterList with status table and inline generate"
```

---

## Task 11: Chapter Detail Page

**Files:**
- Create: `frontend/src/pages/ChapterDetail.tsx`

- [ ] **Step 1: Create frontend/src/pages/ChapterDetail.tsx**

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
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
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
          setStatus('生成完成，正在更新记忆…')
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
    if (!novelId) return
    try {
      const updated = await api.chapters.update(novelId, chapterNum, editContent)
      setChapter(updated)
      setEditing(false)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    }
  }

  const title = novel?.title ?? '…'

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '章节列表', href: `/novels/${novelId}/chapters` },
      { label: `第 ${chapterNum} 章` },
    ]}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">第 {chapterNum} 章</h1>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`text-sm ${status.startsWith('错误') || status.startsWith('保存失败') ? 'text-red-600' : 'text-green-600'}`}>
                {status}
              </span>
            )}
            {!editing && (
              <button
                className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={isGenerating}
                onClick={() => setEditing(true)}
              >
                编辑
              </button>
            )}
            {editing && (
              <>
                <button
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                  onClick={handleSave}
                >
                  保存
                </button>
                <button
                  className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                  onClick={() => { setEditing(false); setEditContent(chapter?.content ?? '') }}
                >
                  取消
                </button>
              </>
            )}
            <button
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={isGenerating}
              onClick={handleRegenerate}
            >
              {isGenerating ? '生成中…' : '重新生成'}
            </button>
          </div>
        </div>

        {/* Meta */}
        {chapter && (
          <div className="flex gap-4 text-sm text-gray-400">
            <span>{chapter.content.length} 字</span>
            {chapter.summary && <span>·</span>}
            {chapter.summary && <span className="truncate max-w-md">{chapter.summary}</span>}
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea
            ref={contentRef}
            className="w-full border rounded px-4 py-3 h-[70vh] font-mono text-sm leading-relaxed resize-none"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
          />
        ) : (
          <div
            ref={contentRef as unknown as React.RefObject<HTMLDivElement>}
            className="w-full border rounded px-4 py-3 h-[70vh] font-mono text-sm leading-relaxed overflow-y-auto bg-white whitespace-pre-wrap"
          >
            {chapter?.content || <span className="text-gray-300">（暂无内容）</span>}
          </div>
        )}

        {/* Prev / Next */}
        <div className="flex justify-between text-sm">
          {chapterNum > 1 ? (
            <button
              className="text-blue-600 hover:underline"
              onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum - 1}`)}
            >
              ← 第 {chapterNum - 1} 章
            </button>
          ) : <span />}
          <button
            className="text-blue-600 hover:underline"
            onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum + 1}`)}
          >
            第 {chapterNum + 1} 章 →
          </button>
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cannot find module './pages/" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ChapterDetail.tsx
git commit -m "feat: ChapterDetail with view/edit/regenerate and prev/next navigation"
```

---

## Task 12: Novel Settings Page and Final E2E

**Files:**
- Create: `frontend/src/pages/NovelSettings.tsx`

- [ ] **Step 1: Create frontend/src/pages/NovelSettings.tsx**

```tsx
// frontend/src/pages/NovelSettings.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Character, Novel } from '../api/types'

export default function NovelSettings() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()

  const [novel, setNovel] = useState<Novel | null>(null)
  const [worldBible, setWorldBible] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [charProfiles, setCharProfiles] = useState<Record<string, string>>({})
  const [newCharName, setNewCharName] = useState('')
  const [newCharProfile, setNewCharProfile] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setNovel(n)
      setWorldBible(n.world_bible)
      setAutoGenerate(n.auto_generate)
      setDailyTime(n.daily_time)
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
      await api.novels.update(novelId, {
        world_bible: worldBible,
        auto_generate: autoGenerate,
        daily_time: dailyTime,
      })
      setStatus('设定已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败，请重试')
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
      setStatus('添加角色失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateChar(charId: string, profile: string) {
    if (!novelId) return
    await api.characters.update(novelId, charId, profile).catch(console.error)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  const title = novel?.title ?? '…'

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '设定' },
    ]}>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">{title} — 设定</h1>

        {/* World Bible */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">世界观 / 故事圣经</h2>
          <textarea
            className="w-full border rounded px-3 py-2 h-40"
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </section>

        {/* Auto generation */}
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">自动生成设置</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoGen">开启每日自动生章</label>
          </div>
          {autoGenerate && (
            <div className="flex items-center gap-3 pl-7">
              <label className="text-sm text-gray-600">每天生成时间</label>
              <input
                type="time"
                className="border rounded px-2 py-1"
                value={dailyTime}
                onChange={e => setDailyTime(e.target.value)}
              />
            </div>
          )}
        </section>

        {/* Save world bible + auto gen together */}
        <div className="flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
            disabled={saving}
            onClick={handleSaveAll}
          >
            保存设定
          </button>
          {status && (
            <span className={`text-sm ${status.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>
              {status}
            </span>
          )}
        </div>

        {/* Characters */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">角色档案</h2>
          {characters.map(c => (
            <div key={c.id} className="border rounded p-3 space-y-2">
              <div className="font-medium">{c.name}</div>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm h-20"
                value={charProfiles[c.id] ?? c.profile}
                onChange={e => setCharProfiles(prev => ({ ...prev, [c.id]: e.target.value }))}
                onBlur={e => handleUpdateChar(c.id, e.target.value).catch(console.error)}
              />
            </div>
          ))}
          <div className="border rounded p-3 space-y-2 bg-gray-50">
            <div className="font-medium text-gray-600">添加新角色</div>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="角色名"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
            />
            <textarea
              className="w-full border rounded px-2 py-1 h-20"
              placeholder="角色档案描述"
              value={newCharProfile}
              onChange={e => setNewCharProfile(e.target.value)}
            />
            <button
              className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
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

- [ ] **Step 2: Run full TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

Expected: `TS OK` with zero errors (all page files now exist).

- [ ] **Step 3: Run full backend test suite**

```bash
cd /Users/cpuser/Desktop/Sunny/fiction-ai-agent
source .venv/bin/activate && pytest tests/ -v
```

Expected: all 29 tests PASS.

- [ ] **Step 4: Final commit**

```bash
git add frontend/src/pages/NovelSettings.tsx
git commit -m "feat: NovelSettings with world bible, auto-gen toggle, character management"
```

- [ ] **Step 5: Commit plan doc**

```bash
git add docs/superpowers/plans/2026-05-20-fiction-ai-agent-v2.md
git commit -m "docs: v2 implementation plan"
```

---

## Self-Review

**Spec coverage check:**
- Dashboard with stats cards and recent activity: ✅ Task 7
- Novel list with status badges: ✅ Task 8
- Novel detail with overview/stats: ✅ Task 9
- Chapter list with status table: ✅ Task 10
- Chapter detail with view/edit/regenerate: ✅ Task 11
- Novel settings (world bible + characters + auto-gen): ✅ Task 12
- APScheduler integration: ✅ Task 3 + Task 4
- DB auto_generate + daily_time columns: ✅ Task 1
- Scheduler wired into FastAPI lifespan: ✅ Task 4
- Frontend API client extended: ✅ Task 5
- Layout + breadcrumb nav: ✅ Task 6

**Placeholder scan:** No TBD, TODO, or "similar to" references found.

**Type consistency check:**
- `ChapterListItem` defined in Task 2 (models.py), used in Task 4 (main.py), Task 5 (types.ts), Task 10 (ChapterList.tsx) — consistent
- `StatsResponse` defined in Task 2, endpoint in Task 4, type in Task 5, page in Task 7 — consistent
- `Novel.auto_generate / daily_time` added in Task 1 DB, Task 2 model, Task 5 types — consistent
- `api.chapters.list()` defined in Task 5, used in Task 9, 10 — consistent
- `scheduler.schedule_novel / unschedule_novel` defined in Task 3, called in Task 4 — consistent
- `db.list_auto_generate_novels()` defined in Task 1, called in Task 4 lifespan — consistent
