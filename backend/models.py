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
