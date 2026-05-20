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
        self.migrate()

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

    def migrate(self):
        import sqlite3 as _sqlite3
        migrations = [
            ("novels", "auto_generate", "INTEGER NOT NULL DEFAULT 0"),
            ("novels", "daily_time", "TEXT NOT NULL DEFAULT '08:00'"),
        ]
        with self._conn() as conn:
            for table, col, definition in migrations:
                try:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
                except _sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e):
                        raise

    def set_auto_generate(self, novel_id: str, enabled: bool, daily_time: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE novels SET auto_generate = ?, daily_time = ? WHERE id = ?",
                (1 if enabled else 0, daily_time, novel_id)
            )

    def list_auto_generate_novels(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, title, daily_time FROM novels WHERE auto_generate = 1 ORDER BY created_at"
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
