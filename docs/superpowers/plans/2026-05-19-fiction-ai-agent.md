# Fiction AI Agent - Novel Writing Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local full-stack web app that uses Claude to auto-write 100+ chapter novels with persistent "Story Bible + Rolling Memory" so character and plot consistency is maintained across the entire work.

**Architecture:** FastAPI backend streams Claude output chapter-by-chapter; each chapter generation assembles a fixed ~2000-token context from SQLite (world bible, character profiles, outline slice, recent summaries) plus ChromaDB semantic retrieval of historically relevant plot fragments. After each chapter finishes, background tasks update summaries, character states, and the vector store.

**Tech Stack:** Python 3.11+, FastAPI, Anthropic SDK (claude-sonnet-4-6 / claude-haiku-4-5-20251001), SQLite (stdlib sqlite3), ChromaDB, pytest, pytest-asyncio, httpx; React 18, TypeScript, Vite, Tailwind CSS

---

## File Structure

```
fiction-ai-agent/
├── backend/
│   ├── models.py          # Pydantic request/response models
│   ├── database.py        # SQLite CRUD (novels, characters, outlines, chapters)
│   ├── vector_store.py    # ChromaDB wrapper (add events, semantic search)
│   ├── memory_manager.py  # Context assembly + post-chapter background updates
│   ├── novel_engine.py    # Claude streaming generator + prompts
│   └── main.py            # FastAPI app, all HTTP routes
├── tests/
│   ├── conftest.py        # Shared fixtures (tmp db, mock anthropic)
│   ├── test_database.py
│   ├── test_vector_store.py
│   ├── test_memory_manager.py
│   └── test_novel_engine.py
├── frontend/
│   ├── index.html
│   ├── vite.config.ts     # Dev proxy → localhost:8000
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx        # Routes: /setup, /outline, /write
│   │   ├── api/client.ts  # fetch wrappers for every backend endpoint
│   │   └── pages/
│   │       ├── Setup.tsx  # Novel title, world bible, character management
│   │       ├── Outline.tsx # Per-chapter outline table (add/edit)
│   │       └── Writer.tsx  # Chapter selector + SSE streaming display
├── data/                  # SQLite DB + ChromaDB (git-ignored)
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Create requirements.txt**

```text
fastapi==0.115.0
uvicorn[standard]==0.30.6
anthropic==0.40.0
chromadb==0.5.23
python-dotenv==1.0.1
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 3: Create .gitignore**

```
data/
.env
__pycache__/
*.pyc
.pytest_cache/
node_modules/
dist/
```

- [ ] **Step 4: Install Python deps**

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 5: Scaffold frontend**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 6: Create vite.config.ts** (replaces generated one)

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 7: Create backend package marker**

```bash
touch backend/__init__.py tests/__init__.py
mkdir -p data
```

- [ ] **Step 8: Commit**

```bash
git init
git add requirements.txt .env.example .gitignore frontend/ backend/__init__.py tests/__init__.py
git commit -m "feat: project scaffold - FastAPI + Vite/React"
```

---

## Task 2: Data Models

**Files:**
- Create: `backend/models.py`

- [ ] **Step 1: Write backend/models.py**

```python
# backend/models.py
from pydantic import BaseModel
from typing import Optional

class NovelCreate(BaseModel):
    title: str
    world_bible: str = ""

class NovelUpdate(BaseModel):
    world_bible: str

class NovelResponse(BaseModel):
    id: str
    title: str
    world_bible: str
    created_at: str

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
```

- [ ] **Step 2: Commit**

```bash
git add backend/models.py
git commit -m "feat: pydantic request/response models"
```

---

## Task 3: Database Layer

**Files:**
- Create: `backend/database.py`
- Create: `tests/test_database.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/conftest.py
import pytest
import tempfile
import os
from backend.database import Database

@pytest.fixture
def db():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    database = Database(db_path)
    database.initialize()
    yield database
    os.unlink(db_path)
```

```python
# tests/test_database.py
import pytest
from tests.conftest import db  # noqa: F401

def test_create_and_get_novel(db):
    novel_id = db.create_novel("仙侠传", "修真世界，灵气复苏")
    novel = db.get_novel(novel_id)
    assert novel["title"] == "仙侠传"
    assert novel["world_bible"] == "修真世界，灵气复苏"
    assert "id" in novel

def test_update_world_bible(db):
    novel_id = db.create_novel("仙侠传")
    db.update_world_bible(novel_id, "新的世界观设定")
    novel = db.get_novel(novel_id)
    assert novel["world_bible"] == "新的世界观设定"

def test_create_and_get_characters(db):
    novel_id = db.create_novel("仙侠传")
    char_id = db.create_character(novel_id, "叶辰", "主角，剑修，性格坚毅")
    chars = db.get_characters(novel_id)
    assert len(chars) == 1
    assert chars[0]["name"] == "叶辰"
    assert chars[0]["id"] == char_id

def test_update_character(db):
    novel_id = db.create_novel("仙侠传")
    char_id = db.create_character(novel_id, "叶辰", "初始档案")
    db.update_character(char_id, "突破金丹期")
    chars = db.get_characters(novel_id)
    assert chars[0]["profile"] == "突破金丹期"

def test_upsert_outline(db):
    novel_id = db.create_novel("仙侠传")
    db.upsert_outline(novel_id, 1, "第一章大纲：主角觉醒")
    db.upsert_outline(novel_id, 1, "更新后的大纲")
    outlines = db.get_outlines(novel_id)
    assert len(outlines) == 1
    assert outlines[0]["outline"] == "更新后的大纲"

def test_get_outline_slice_window(db):
    novel_id = db.create_novel("仙侠传")
    for i in range(1, 8):
        db.upsert_outline(novel_id, i, f"第{i}章大纲")
    slice_ = db.get_outline_slice(novel_id, 4, window=2)
    nums = [o["chapter_num"] for o in slice_]
    assert nums == [2, 3, 4, 5, 6]

def test_save_and_get_chapter(db):
    novel_id = db.create_novel("仙侠传")
    db.save_chapter_content(novel_id, 1, "第一章正文内容")
    chapter = db.get_chapter(novel_id, 1)
    assert chapter["content"] == "第一章正文内容"
    assert chapter["summary"] == ""

def test_save_chapter_summary(db):
    novel_id = db.create_novel("仙侠传")
    db.save_chapter_content(novel_id, 1, "正文")
    db.save_chapter_summary(novel_id, 1, "摘要")
    chapter = db.get_chapter(novel_id, 1)
    assert chapter["summary"] == "摘要"

def test_get_recent_summaries(db):
    novel_id = db.create_novel("仙侠传")
    for i in range(1, 6):
        db.save_chapter_content(novel_id, i, f"第{i}章正文")
        db.save_chapter_summary(novel_id, i, f"第{i}章摘要")
    summaries = db.get_recent_summaries(novel_id, current_chapter=6, limit=3)
    assert len(summaries) == 3
    assert summaries[0]["chapter_num"] == 3
    assert summaries[2]["chapter_num"] == 5

def test_list_novels(db):
    db.create_novel("小说A")
    db.create_novel("小说B")
    novels = db.list_novels()
    assert len(novels) == 2
```

- [ ] **Step 2: Run tests — expect all FAIL**

```bash
pytest tests/test_database.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` for `backend.database`.

- [ ] **Step 3: Implement backend/database.py**

```python
# backend/database.py
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Optional

class Database:
    def __init__(self, db_path: str = "data/novel.db"):
        self.db_path = db_path

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

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

    def create_novel(self, title: str, world_bible: str = "") -> str:
        novel_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO novels (id, title, world_bible) VALUES (?, ?, ?)",
                (novel_id, title, world_bible)
            )
        return novel_id

    def get_novel(self, novel_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM novels WHERE id = ?", (novel_id,)
            ).fetchone()
        return dict(row) if row else None

    def list_novels(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM novels ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def update_world_bible(self, novel_id: str, world_bible: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE novels SET world_bible = ? WHERE id = ?",
                (world_bible, novel_id)
            )

    def create_character(self, novel_id: str, name: str, profile: str) -> str:
        char_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO characters (id, novel_id, name, profile) VALUES (?, ?, ?, ?)",
                (char_id, novel_id, name, profile)
            )
        return char_id

    def get_characters(self, novel_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM characters WHERE novel_id = ? ORDER BY rowid",
                (novel_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def update_character(self, char_id: str, profile: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE characters SET profile = ?, updated_at = datetime('now') WHERE id = ?",
                (profile, char_id)
            )

    def upsert_outline(self, novel_id: str, chapter_num: int, outline: str):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO chapter_outlines (novel_id, chapter_num, outline)
                   VALUES (?, ?, ?)
                   ON CONFLICT(novel_id, chapter_num) DO UPDATE SET outline = excluded.outline""",
                (novel_id, chapter_num, outline)
            )

    def get_outlines(self, novel_id: str) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chapter_outlines WHERE novel_id = ? ORDER BY chapter_num",
                (novel_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_outline_slice(self, novel_id: str, chapter_num: int, window: int = 2) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT * FROM chapter_outlines
                   WHERE novel_id = ? AND chapter_num BETWEEN ? AND ?
                   ORDER BY chapter_num""",
                (novel_id, chapter_num - window, chapter_num + window)
            ).fetchall()
        return [dict(r) for r in rows]

    def save_chapter_content(self, novel_id: str, chapter_num: int, content: str):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO chapters (novel_id, chapter_num, content)
                   VALUES (?, ?, ?)
                   ON CONFLICT(novel_id, chapter_num) DO UPDATE SET content = excluded.content""",
                (novel_id, chapter_num, content)
            )

    def save_chapter_summary(self, novel_id: str, chapter_num: int, summary: str):
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO chapters (novel_id, chapter_num, summary)
                   VALUES (?, ?, '')
                   ON CONFLICT(novel_id, chapter_num) DO UPDATE SET summary = ?""",
                (novel_id, chapter_num, summary)
            )

    def get_chapter(self, novel_id: str, chapter_num: int) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM chapters WHERE novel_id = ? AND chapter_num = ?",
                (novel_id, chapter_num)
            ).fetchone()
        if row:
            return dict(row)
        return {"novel_id": novel_id, "chapter_num": chapter_num, "content": "", "summary": ""}

    def get_recent_summaries(self, novel_id: str, current_chapter: int, limit: int = 5) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                """SELECT chapter_num, summary FROM chapters
                   WHERE novel_id = ? AND chapter_num < ? AND summary != ''
                   ORDER BY chapter_num DESC
                   LIMIT ?""",
                (novel_id, current_chapter, limit)
            ).fetchall()
        return [dict(r) for r in reversed(rows)]
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pytest tests/test_database.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/database.py tests/conftest.py tests/test_database.py
git commit -m "feat: SQLite database layer with full CRUD"
```

---

## Task 4: Vector Store

**Files:**
- Create: `backend/vector_store.py`
- Create: `tests/test_vector_store.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_vector_store.py
import pytest
import tempfile
import shutil
from backend.vector_store import VectorStore

@pytest.fixture
def vs():
    tmpdir = tempfile.mkdtemp()
    store = VectorStore(novel_id="test-novel-001", chroma_path=tmpdir)
    yield store
    shutil.rmtree(tmpdir, ignore_errors=True)

def test_search_empty_returns_empty(vs):
    results = vs.search("主角遇到强敌", top_k=5)
    assert results == []

def test_add_and_search(vs):
    vs.add_events(1, ["叶辰在山洞中发现了上古剑法", "叶辰击败了宗门师兄"])
    vs.add_events(2, ["叶辰参加了宗门大比"])
    results = vs.search("叶辰的战斗经历", top_k=5)
    assert len(results) > 0
    assert all(isinstance(r, str) for r in results)

def test_top_k_respected(vs):
    for i in range(10):
        vs.add_events(i + 1, [f"事件{i}：主角做了某事"])
    results = vs.search("主角事件", top_k=3)
    assert len(results) <= 3

def test_duplicate_ids_dont_crash(vs):
    vs.add_events(1, ["第一次写入"])
    vs.add_events(1, ["第二次写入，相同章节"])
    results = vs.search("写入", top_k=5)
    assert len(results) > 0
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_vector_store.py -v
```

Expected: `ImportError` for `backend.vector_store`.

- [ ] **Step 3: Implement backend/vector_store.py**

```python
# backend/vector_store.py
import chromadb

class VectorStore:
    def __init__(self, novel_id: str, chroma_path: str = "data/chroma"):
        self.novel_id = novel_id
        client = chromadb.PersistentClient(path=chroma_path)
        self.collection = client.get_or_create_collection(
            name=f"novel_{novel_id.replace('-', '_')}",
            metadata={"hnsw:space": "cosine"}
        )

    def add_events(self, chapter_num: int, events: list[str]):
        if not events:
            return
        ids = [f"ch{chapter_num}_ev{i}" for i in range(len(events))]
        # Upsert to handle re-generation of the same chapter
        self.collection.upsert(
            documents=events,
            ids=ids,
            metadatas=[{"chapter_num": chapter_num}] * len(events)
        )

    def search(self, query: str, top_k: int = 5) -> list[str]:
        count = self.collection.count()
        if count == 0:
            return []
        results = self.collection.query(
            query_texts=[query],
            n_results=min(top_k, count)
        )
        return results["documents"][0] if results["documents"] else []
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pytest tests/test_vector_store.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/vector_store.py tests/test_vector_store.py
git commit -m "feat: ChromaDB vector store with upsert and semantic search"
```

---

## Task 5: Novel Engine (Claude Integration)

**Files:**
- Create: `backend/novel_engine.py`
- Create: `tests/test_novel_engine.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_novel_engine.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_generate_chapter_stream_yields_text():
    from backend.novel_engine import NovelEngine

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async def fake_text_stream():
        for chunk in ["这是", "第一章", "内容"]:
            yield chunk

    mock_stream_ctx.text_stream = fake_text_stream()

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = MagicMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream_ctx

        engine = NovelEngine()
        chunks = []
        async for chunk in engine.generate_chapter_stream("some context"):
            chunks.append(chunk)

    assert chunks == ["这是", "第一章", "内容"]

@pytest.mark.asyncio
async def test_summarize_returns_string():
    from backend.novel_engine import NovelEngine

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="这章主角突破了金丹期。")]

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = AsyncMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        engine = NovelEngine()
        summary = await engine.summarize("很长的章节内容...")

    assert isinstance(summary, str)
    assert len(summary) > 0

@pytest.mark.asyncio
async def test_extract_key_events_returns_list():
    from backend.novel_engine import NovelEngine

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="- 叶辰突破金丹\n- 师傅离去\n- 宗门大比开始")]

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = AsyncMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        engine = NovelEngine()
        events = await engine.extract_key_events("章节内容...")

    assert isinstance(events, list)
    assert len(events) >= 1
    assert all(isinstance(e, str) for e in events)
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_novel_engine.py -v
```

Expected: `ImportError` for `backend.novel_engine`.

- [ ] **Step 3: Implement backend/novel_engine.py**

```python
# backend/novel_engine.py
import os
import anthropic
from dotenv import load_dotenv
from typing import AsyncIterator

load_dotenv()

WRITER_SYSTEM_PROMPT = """你是一位专业的中文网络小说作家，擅长写仙侠、玄幻、都市等类型的长篇小说。
你的写作风格：
- 情节紧凑，节奏感强
- 人物性格鲜明，对话自然
- 场景描写生动，代入感强
- 每章字数在1500-2500字之间
严格按照提供的世界观设定、角色档案和章节大纲来写作，保持角色性格和剧情的一致性。"""

HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

class NovelEngine:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )

    async def generate_chapter_stream(self, context: str) -> AsyncIterator[str]:
        async with self.client.messages.stream(
            model=SONNET_MODEL,
            max_tokens=3000,
            system=WRITER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": context}]
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def summarize(self, content: str) -> str:
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": f"请用100字以内概括以下章节的主要情节，只输出摘要，不要任何前缀：\n\n{content}"
            }]
        )
        return response.content[0].text.strip()

    async def extract_key_events(self, content: str) -> list[str]:
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": f"从以下章节中提取3-5个关键情节事件，每行一个，用「-」开头，只输出事件列表：\n\n{content}"
            }]
        )
        lines = response.content[0].text.strip().split('\n')
        return [line.lstrip('- ').strip() for line in lines if line.strip()]

    async def extract_char_updates(self, content: str, characters: list[dict]) -> dict[str, str]:
        if not characters:
            return {}
        char_names = [c["name"] for c in characters]
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": (
                    f"分析以下章节中这些角色的状态变化：{', '.join(char_names)}\n\n"
                    f"章节内容：\n{content}\n\n"
                    "对于每个有明显状态变化的角色，用JSON格式输出 {{\"角色名\": \"角色最新完整状态描述\"}}。"
                    "如果角色无变化则不包含该角色。只输出JSON对象，不要其他文字。"
                )
            }]
        )
        import json
        try:
            updates_by_name = json.loads(response.content[0].text.strip())
            name_to_id = {c["name"]: c["id"] for c in characters}
            return {
                name_to_id[name]: profile
                for name, profile in updates_by_name.items()
                if name in name_to_id
            }
        except (json.JSONDecodeError, KeyError):
            return {}
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pytest tests/test_novel_engine.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/novel_engine.py tests/test_novel_engine.py
git commit -m "feat: novel engine with Claude streaming, summarize, event/char extraction"
```

---

## Task 6: Memory Manager

**Files:**
- Create: `backend/memory_manager.py`
- Create: `tests/test_memory_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_memory_manager.py
import pytest
import tempfile
import os
import shutil
from unittest.mock import AsyncMock, patch
from backend.database import Database
from backend.memory_manager import MemoryManager

@pytest.fixture
def setup(tmp_path):
    db_path = str(tmp_path / "test.db")
    chroma_path = str(tmp_path / "chroma")
    db = Database(db_path)
    db.initialize()

    novel_id = db.create_novel("仙侠传", "修真世界，灵气复苏，万年前大战遗迹散落各处。")
    db.create_character(novel_id, "叶辰", "主角，剑修，初入江湖")
    for i in range(1, 6):
        db.upsert_outline(novel_id, i, f"第{i}章大纲")
    for i in range(1, 4):
        db.save_chapter_content(novel_id, i, f"第{i}章内容")
        db.save_chapter_summary(novel_id, i, f"第{i}章摘要")

    mm = MemoryManager(novel_id=novel_id, chroma_path=chroma_path)
    return mm, db, novel_id

def test_build_context_contains_world_bible(setup):
    mm, db, novel_id = setup
    ctx = mm.build_context(chapter_num=4, db=db)
    assert "修真世界" in ctx

def test_build_context_contains_character_profile(setup):
    mm, db, novel_id = setup
    ctx = mm.build_context(chapter_num=4, db=db)
    assert "叶辰" in ctx

def test_build_context_contains_outline_slice(setup):
    mm, db, novel_id = setup
    ctx = mm.build_context(chapter_num=4, db=db)
    assert "第4章大纲" in ctx
    assert "第3章大纲" in ctx
    assert "第5章大纲" in ctx

def test_build_context_contains_recent_summaries(setup):
    mm, db, novel_id = setup
    ctx = mm.build_context(chapter_num=4, db=db)
    assert "第3章摘要" in ctx

def test_build_context_contains_chapter_instruction(setup):
    mm, db, novel_id = setup
    ctx = mm.build_context(chapter_num=4, db=db)
    assert "第4章" in ctx

@pytest.mark.asyncio
async def test_after_chapter_written_saves_summary(setup):
    mm, db, novel_id = setup
    with patch.object(mm.engine, 'summarize', new=AsyncMock(return_value="测试摘要")), \
         patch.object(mm.engine, 'extract_key_events', new=AsyncMock(return_value=["事件1"])), \
         patch.object(mm.engine, 'extract_char_updates', new=AsyncMock(return_value={})):
        await mm.after_chapter_written(chapter_num=4, content="第四章内容", db=db)

    chapter = db.get_chapter(novel_id, 4)
    assert chapter["summary"] == "测试摘要"
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_memory_manager.py -v
```

Expected: `ImportError` for `backend.memory_manager`.

- [ ] **Step 3: Implement backend/memory_manager.py**

```python
# backend/memory_manager.py
from backend.database import Database
from backend.vector_store import VectorStore
from backend.novel_engine import NovelEngine

class MemoryManager:
    def __init__(self, novel_id: str, chroma_path: str = "data/chroma"):
        self.novel_id = novel_id
        self.vector_store = VectorStore(novel_id=novel_id, chroma_path=chroma_path)
        self.engine = NovelEngine()

    def build_context(self, chapter_num: int, db: Database) -> str:
        novel = db.get_novel(self.novel_id)
        characters = db.get_characters(self.novel_id)
        outline_slice = db.get_outline_slice(self.novel_id, chapter_num, window=2)
        current_outline_rows = [o for o in outline_slice if o["chapter_num"] == chapter_num]
        current_outline = current_outline_rows[0]["outline"] if current_outline_rows else f"第{chapter_num}章"
        relevant_memories = self.vector_store.search(current_outline, top_k=5)
        recent_summaries = db.get_recent_summaries(self.novel_id, chapter_num, limit=5)

        parts = []

        if novel and novel.get("world_bible"):
            parts.append(f"## 世界观设定\n{novel['world_bible']}")

        if characters:
            char_text = "\n".join(f"**{c['name']}**: {c['profile']}" for c in characters)
            parts.append(f"## 角色档案\n{char_text}")

        if outline_slice:
            outline_text = "\n".join(
                f"第{o['chapter_num']}章: {o['outline']}" for o in outline_slice
            )
            parts.append(f"## 章节大纲\n{outline_text}")

        if relevant_memories:
            mem_text = "\n".join(f"- {m}" for m in relevant_memories)
            parts.append(f"## 相关历史情节（语义检索）\n{mem_text}")

        if recent_summaries:
            summary_text = "\n".join(
                f"第{s['chapter_num']}章摘要: {s['summary']}" for s in recent_summaries
            )
            parts.append(f"## 近期章节摘要\n{summary_text}")

        parts.append(f"\n请根据以上背景，按照第{chapter_num}章大纲，写出第{chapter_num}章的完整内容。")

        return "\n\n".join(parts)

    async def after_chapter_written(self, chapter_num: int, content: str, db: Database):
        characters = db.get_characters(self.novel_id)

        summary = await self.engine.summarize(content)
        db.save_chapter_summary(self.novel_id, chapter_num, summary)

        key_events = await self.engine.extract_key_events(content)
        self.vector_store.add_events(chapter_num, key_events)

        char_updates = await self.engine.extract_char_updates(content, characters)
        for char_id, new_profile in char_updates.items():
            db.update_character(char_id, new_profile)
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pytest tests/test_memory_manager.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite to ensure no regressions**

```bash
pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/memory_manager.py tests/test_memory_manager.py
git commit -m "feat: memory manager - context assembly and post-chapter background updates"
```

---

## Task 7: FastAPI App

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Implement backend/main.py**

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
from backend.models import (
    NovelCreate, NovelUpdate, NovelResponse,
    CharacterCreate, CharacterUpdate, CharacterResponse,
    OutlineUpsert, OutlineResponse,
    ChapterResponse, ChapterUpdate,
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
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB = Annotated[Database, Depends(get_db)]

# --- Novels ---

@app.post("/api/novels", response_model=NovelResponse)
def create_novel(body: NovelCreate, db: DB):
    novel_id = db.create_novel(body.title, body.world_bible)
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
    db.update_world_bible(novel_id, body.world_bible)
    return db.get_novel(novel_id)

# --- Characters ---

@app.post("/api/novels/{novel_id}/characters", response_model=CharacterResponse)
def create_character(novel_id: str, body: CharacterCreate, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    char_id = db.create_character(novel_id, body.name, body.profile)
    return next(c for c in db.get_characters(novel_id) if c["id"] == char_id)

@app.get("/api/novels/{novel_id}/characters", response_model=list[CharacterResponse])
def list_characters(novel_id: str, db: DB):
    return db.get_characters(novel_id)

@app.put("/api/novels/{novel_id}/characters/{char_id}", response_model=CharacterResponse)
def update_character(novel_id: str, char_id: str, body: CharacterUpdate, db: DB):
    db.update_character(char_id, body.profile)
    chars = db.get_characters(novel_id)
    char = next((c for c in chars if c["id"] == char_id), None)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char

# --- Outlines ---

@app.post("/api/novels/{novel_id}/outlines", response_model=OutlineResponse)
def upsert_outline(novel_id: str, body: OutlineUpsert, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    db.upsert_outline(novel_id, body.chapter_num, body.outline)
    outlines = db.get_outlines(novel_id)
    return next(o for o in outlines if o["chapter_num"] == body.chapter_num)

@app.get("/api/novels/{novel_id}/outlines", response_model=list[OutlineResponse])
def list_outlines(novel_id: str, db: DB):
    return db.get_outlines(novel_id)

# --- Chapters ---

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

        db.save_chapter_content(novel_id, chapter_num, full_text)
        asyncio.create_task(
            mm.after_chapter_written(chapter_num=chapter_num, content=full_text, db=db)
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 2: Start the server and verify routes exist**

```bash
source .venv/bin/activate
ANTHROPIC_API_KEY=test uvicorn backend.main:app --reload --port 8000
```

In a second terminal:
```bash
curl http://localhost:8000/api/novels
```

Expected: `[]` (empty list, 200 OK).

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: FastAPI app with all REST routes and SSE chapter generation"
```

---

## Task 8: Frontend API Client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// frontend/src/api/types.ts
export interface Novel {
  id: string
  title: string
  world_bible: string
  created_at: string
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
```

- [ ] **Step 2: Create client.ts**

```typescript
// frontend/src/api/client.ts
import type { Novel, Character, Outline, Chapter } from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Novels
export const api = {
  novels: {
    list: () => req<Novel[]>('/novels'),
    get: (id: string) => req<Novel>(`/novels/${id}`),
    create: (title: string, world_bible: string) =>
      req<Novel>('/novels', { method: 'POST', body: JSON.stringify({ title, world_bible }) }),
    update: (id: string, world_bible: string) =>
      req<Novel>(`/novels/${id}`, { method: 'PUT', body: JSON.stringify({ world_bible }) }),
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
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError(parsed.error); return }
            if (parsed.text) onChunk(parsed.text)
          } catch {}
        }
      }
      onDone()
    },
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: typed API client for all backend endpoints"
```

---

## Task 9: Setup Page

**Files:**
- Create: `frontend/src/pages/Setup.tsx`

- [ ] **Step 1: Implement Setup.tsx**

```tsx
// frontend/src/pages/Setup.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Character } from '../api/types'

export default function Setup() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [worldBible, setWorldBible] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [newCharName, setNewCharName] = useState('')
  const [newCharProfile, setNewCharProfile] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setTitle(n.title)
      setWorldBible(n.world_bible)
    })
    api.characters.list(novelId).then(setCharacters)
  }, [novelId])

  async function handleSaveWorldBible() {
    if (!novelId) return
    setSaving(true)
    await api.novels.update(novelId, worldBible)
    setStatus('世界观已保存')
    setSaving(false)
    setTimeout(() => setStatus(''), 2000)
  }

  async function handleCreateNovel() {
    const novel = await api.novels.create(title, worldBible)
    navigate(`/setup/${novel.id}`)
  }

  async function handleAddCharacter() {
    if (!novelId || !newCharName || !newCharProfile) return
    const char = await api.characters.create(novelId, newCharName, newCharProfile)
    setCharacters(prev => [...prev, char])
    setNewCharName('')
    setNewCharProfile('')
  }

  async function handleUpdateChar(charId: string, profile: string) {
    if (!novelId) return
    await api.characters.update(novelId, charId, profile)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  if (!novelId) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 space-y-4">
        <h1 className="text-2xl font-bold">新建小说</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="小说标题"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="w-full border rounded px-3 py-2 h-32"
          placeholder="世界观设定（可后续编辑）"
          value={worldBible}
          onChange={e => setWorldBible(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!title}
          onClick={handleCreateNovel}
        >
          创建小说
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 space-y-8">
      <h1 className="text-2xl font-bold">{title} — 设定</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">世界观 / 故事圣经</h2>
        <textarea
          className="w-full border rounded px-3 py-2 h-40"
          value={worldBible}
          onChange={e => setWorldBible(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={saving}
            onClick={handleSaveWorldBible}
          >
            保存
          </button>
          {status && <span className="text-green-600 text-sm">{status}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">角色档案</h2>
        {characters.map(c => (
          <div key={c.id} className="border rounded p-3 space-y-2">
            <div className="font-medium">{c.name}</div>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm h-20"
              defaultValue={c.profile}
              onBlur={e => handleUpdateChar(c.id, e.target.value)}
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
            disabled={!newCharName || !newCharProfile}
            onClick={handleAddCharacter}
          >
            添加
          </button>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/outline/${novelId}`)}
        >
          下一步：章节大纲 →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Setup.tsx
git commit -m "feat: Setup page for world bible and character management"
```

---

## Task 10: Outline Page

**Files:**
- Create: `frontend/src/pages/Outline.tsx`

- [ ] **Step 1: Implement Outline.tsx**

```tsx
// frontend/src/pages/Outline.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Outline } from '../api/types'

export default function OutlinePage() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [newChapterNum, setNewChapterNum] = useState(1)
  const [newOutlineText, setNewOutlineText] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.outlines.list(novelId).then(setOutlines)
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

  return (
    <div className="max-w-3xl mx-auto mt-8 p-6 space-y-6">
      <h1 className="text-2xl font-bold">章节大纲</h1>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left w-16">章节</th>
            <th className="border px-3 py-2 text-left">大纲</th>
          </tr>
        </thead>
        <tbody>
          {outlines.map(o => (
            <tr key={o.chapter_num}>
              <td className="border px-3 py-2 text-center font-mono">{o.chapter_num}</td>
              <td className="border px-2 py-1">
                <textarea
                  className="w-full text-sm px-1 py-1 resize-none"
                  rows={2}
                  defaultValue={o.outline}
                  onBlur={e => handleUpsert(o.chapter_num, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border rounded p-3 space-y-2 bg-gray-50">
        <div className="font-medium text-gray-600">添加章节大纲</div>
        <div className="flex gap-2 items-center">
          <label className="text-sm">第</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-16"
            value={newChapterNum}
            min={1}
            onChange={e => setNewChapterNum(Number(e.target.value))}
          />
          <label className="text-sm">章</label>
        </div>
        <textarea
          className="w-full border rounded px-2 py-1 h-20"
          placeholder="大纲内容..."
          value={newOutlineText}
          onChange={e => setNewOutlineText(e.target.value)}
        />
        <button
          className="bg-green-600 text-white px-3 py-1 rounded text-sm"
          onClick={handleAddNew}
        >
          添加
        </button>
      </div>

      <div className="flex gap-3">
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/setup/${novelId}`)}
        >
          ← 返回设定
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/write/${novelId}`)}
        >
          开始写作 →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Outline.tsx
git commit -m "feat: Outline page with inline-edit chapter outline table"
```

---

## Task 11: Writer Page

**Files:**
- Create: `frontend/src/pages/Writer.tsx`

- [ ] **Step 1: Implement Writer.tsx**

```tsx
// frontend/src/pages/Writer.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

export default function Writer() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()

  const [chapterNum, setChapterNum] = useState(1)
  const [content, setContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [novelTitle, setNovelTitle] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => setNovelTitle(n.title))
  }, [novelId])

  useEffect(() => {
    if (!novelId) return
    api.chapters.get(novelId, chapterNum).then(ch => setContent(ch.content))
  }, [novelId, chapterNum])

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isGenerating && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, isGenerating])

  async function handleGenerate() {
    if (!novelId || isGenerating) return
    setIsGenerating(true)
    setContent('')
    setStatus('生成中...')

    await api.chapters.generateStream(
      novelId,
      chapterNum,
      chunk => setContent(prev => prev + chunk),
      () => {
        setIsGenerating(false)
        setStatus('生成完成，正在更新记忆...')
        setTimeout(() => setStatus(''), 3000)
      },
      err => {
        setIsGenerating(false)
        setStatus(`错误: ${err}`)
      }
    )
  }

  async function handleSave() {
    if (!novelId) return
    await api.chapters.update(novelId, chapterNum, content)
    setStatus('已保存')
    setTimeout(() => setStatus(''), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{novelTitle}</h1>
        <button
          className="text-sm text-gray-500 underline"
          onClick={() => navigate(`/outline/${novelId}`)}
        >
          ← 大纲
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="font-medium">第</label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-20"
          min={1}
          value={chapterNum}
          onChange={e => setChapterNum(Number(e.target.value))}
        />
        <label className="font-medium">章</label>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? '生成中...' : '生成本章'}
        </button>
        <button
          className="bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isGenerating}
          onClick={handleSave}
        >
          保存编辑
        </button>
        {status && <span className="text-sm text-green-700">{status}</span>}
      </div>

      <textarea
        ref={contentRef}
        className="w-full border rounded px-4 py-3 h-[65vh] font-mono text-sm leading-relaxed resize-none"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="点击「生成本章」开始写作，或直接在此输入..."
        disabled={isGenerating}
      />

      <div className="text-sm text-gray-400 text-right">
        {content.length} 字
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Writer.tsx
git commit -m "feat: Writer page with SSE streaming display and manual edit/save"
```

---

## Task 12: App Routing & Home

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Home.tsx`

- [ ] **Step 1: Install react-router**

```bash
cd frontend && npm install react-router-dom
```

- [ ] **Step 2: Create Home.tsx**

```tsx
// frontend/src/pages/Home.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function Home() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])

  useEffect(() => {
    api.novels.list().then(setNovels)
  }, [])

  return (
    <div className="max-w-2xl mx-auto mt-16 p-6 space-y-6">
      <h1 className="text-3xl font-bold">AI 小说工坊</h1>

      <button
        className="bg-blue-600 text-white px-5 py-2 rounded text-lg"
        onClick={() => navigate('/setup')}
      >
        + 新建小说
      </button>

      {novels.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">已有小说</h2>
          {novels.map(n => (
            <div
              key={n.id}
              className="border rounded p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/write/${n.id}`)}
            >
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-gray-400">{n.created_at.slice(0, 10)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm text-blue-600 underline"
                  onClick={e => { e.stopPropagation(); navigate(`/setup/${n.id}`) }}
                >
                  设定
                </button>
                <button
                  className="text-sm text-blue-600 underline"
                  onClick={e => { e.stopPropagation(); navigate(`/outline/${n.id}`) }}
                >
                  大纲
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import OutlinePage from './pages/Outline'
import Writer from './pages/Writer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/setup/:novelId" element={<Setup />} />
        <Route path="/outline/:novelId" element={<OutlinePage />} />
        <Route path="/write/:novelId" element={<Writer />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Update main.tsx to add Tailwind import**

Replace contents of `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Replace `frontend/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Update `frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 5: Run full app end-to-end**

Terminal 1:
```bash
source .venv/bin/activate && ANTHROPIC_API_KEY=your_key uvicorn backend.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

Visit `http://localhost:5173` — create a novel, add characters, add outlines, then generate a chapter. Verify text streams in real time in the Writer page.

- [ ] **Step 6: Run all backend tests one final time**

```bash
pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 7: Final commit**

```bash
git add frontend/src/
git commit -m "feat: App routing, Home page - full application wired up"
```

---

## Self-Review

**Spec coverage check:**
- Story Bible + Rolling Memory context: ✅ Task 6 (MemoryManager.build_context)
- World bible, character profiles, outline slice, semantic retrieval, rolling summaries: ✅ all in build_context
- After-chapter: summary, char update, vector store: ✅ Task 6 (after_chapter_written)
- Streaming SSE from backend: ✅ Task 7 (generate_chapter endpoint)
- Frontend streaming display: ✅ Task 11 (Writer.tsx)
- Setup page (world/character): ✅ Task 9
- Outline editor: ✅ Task 10
- SQLite persistence: ✅ Task 3
- ChromaDB semantic store: ✅ Task 4
- Development order (minimal loop → SQLite → streaming → summaries → vector → char tracking → UI): ✅ tasks follow this progression

**Placeholder scan:** No TBD, TODO, "implement later", or "similar to Task N" found.

**Type consistency check:**
- `Database` methods referenced in MemoryManager tests match Task 3 implementation names: `get_novel`, `get_characters`, `get_outline_slice`, `get_recent_summaries`, `save_chapter_summary`, `save_chapter_content`, `get_chapter`, `update_character` ✅
- `NovelEngine` methods: `generate_chapter_stream`, `summarize`, `extract_key_events`, `extract_char_updates` ✅ consistent across Tasks 5 and 6
- `VectorStore` methods: `add_events`, `search` ✅ consistent across Tasks 4 and 6
- API client method signatures match FastAPI route shapes ✅
