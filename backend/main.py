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
