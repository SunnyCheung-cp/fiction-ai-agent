# backend/models.py
from pydantic import BaseModel, Field
from typing import Optional

class NovelCreate(BaseModel):
    title: str
    world_bible: str = ""
    auto_generate: bool = False
    daily_time: str = Field("08:00", pattern=r"^\d{2}:\d{2}$")
    provider: str = "anthropic"

class NovelUpdate(BaseModel):
    world_bible: Optional[str] = None
    auto_generate: Optional[bool] = None
    daily_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    provider: Optional[str] = None

class NovelResponse(BaseModel):
    id: str
    title: str
    world_bible: str
    created_at: str
    auto_generate: bool
    daily_time: str
    provider: str

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
