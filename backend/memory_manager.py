# backend/memory_manager.py
import asyncio
from backend.database import Database
from backend.vector_store import VectorStore
from backend.novel_engine import NovelEngine

class MemoryManager:
    def __init__(self, novel_id: str, chroma_path: str = "data/chroma", provider: str = "anthropic"):
        self.novel_id = novel_id
        self.vector_store = VectorStore(novel_id=novel_id, chroma_path=chroma_path)
        self.engine = NovelEngine(provider=provider)

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

        title, summary = await asyncio.gather(
            self.engine.generate_title(content, chapter_num),
            self.engine.summarize(content),
        )
        db.save_chapter_title(self.novel_id, chapter_num, title)
        db.save_chapter_summary(self.novel_id, chapter_num, summary)

        key_events = await self.engine.extract_key_events(content)
        self.vector_store.add_events(chapter_num, key_events)

        char_updates = await self.engine.extract_char_updates(content, characters)
        for char_id, new_profile in char_updates.items():
            db.update_character(char_id, new_profile)
