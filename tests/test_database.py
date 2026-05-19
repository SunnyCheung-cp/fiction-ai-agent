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
