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
                   VALUES (?, ?, ?)
                   ON CONFLICT(novel_id, chapter_num) DO UPDATE SET summary = ?""",
                (novel_id, chapter_num, summary, summary)
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
