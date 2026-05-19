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
