# backend/main.py
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.database import Database
from backend.memory_manager import MemoryManager
from backend import scheduler as scheduler_module
from backend import bootstrap as bootstrap_module
from backend.scheduler import scheduler as _scheduler
from backend.models import (
    NovelCreate, NovelUpdate, NovelResponse,
    CharacterCreate, CharacterUpdate, CharacterResponse,
    OutlineUpsert, OutlineResponse,
    ChapterResponse, ChapterUpdate, ChapterListItem, StatsResponse,
)
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

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

# --- Bootstrap ---

@app.post("/api/novels/{novel_id}/bootstrap")
async def bootstrap_novel(
    novel_id: str,
    db: DB,
    chapters: int = 20,
    genre_hint: str = "",
):
    novel = db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")

    provider = novel.get("provider", "anthropic")

    async def event_stream():
        try:
            # Step 1: World Bible
            yield f"data: {json.dumps({'type': 'progress', 'message': '正在生成世界观设定…'}, ensure_ascii=False)}\n\n"
            world_bible = await bootstrap_module.generate_world_bible(novel["title"], genre_hint, provider)
            db.update_world_bible(novel_id, world_bible)
            yield f"data: {json.dumps({'type': 'world_bible', 'content': world_bible}, ensure_ascii=False)}\n\n"

            # Step 2: Characters
            yield f"data: {json.dumps({'type': 'progress', 'message': '正在创建角色档案…'}, ensure_ascii=False)}\n\n"
            characters = await bootstrap_module.generate_characters(novel["title"], world_bible, provider)
            for char in characters:
                db.create_character(novel_id, char["name"], char["profile"])
            yield f"data: {json.dumps({'type': 'characters', 'count': len(characters), 'items': characters}, ensure_ascii=False)}\n\n"

            # Step 3: Outlines
            yield f"data: {json.dumps({'type': 'progress', 'message': f'正在编写前{chapters}章大纲…'}, ensure_ascii=False)}\n\n"
            outlines = await bootstrap_module.generate_outlines(
                novel["title"], world_bible, characters, chapters, provider
            )
            for o in outlines:
                db.upsert_outline(novel_id, o["chapter_num"], o["outline"])
            yield f"data: {json.dumps({'type': 'outlines', 'count': len(outlines)}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'characters': len(characters), 'outlines': len(outlines)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as exc:
            logger.error("Bootstrap failed for novel %s: %s", novel_id, exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# --- Novels ---

@app.post("/api/novels", response_model=NovelResponse)
def create_novel(body: NovelCreate, db: DB):
    novel_id = db.create_novel(body.title, body.world_bible)
    if body.auto_generate:
        db.set_auto_generate(novel_id, True, body.daily_time)
        scheduler_module.schedule_novel(novel_id, body.daily_time)
    db.set_provider(novel_id, body.provider)
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

@app.delete("/api/novels/{novel_id}", status_code=204)
def delete_novel(novel_id: str, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    scheduler_module.unschedule_novel(novel_id)
    db.delete_novel(novel_id)

@app.put("/api/novels/{novel_id}", response_model=NovelResponse)
def update_novel(novel_id: str, body: NovelUpdate, db: DB):
    novel = db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    if body.world_bible is not None:
        db.update_world_bible(novel_id, body.world_bible)
    if body.auto_generate is not None or body.daily_time is not None:
        enabled = body.auto_generate if body.auto_generate is not None else bool(novel["auto_generate"])
        sched_time = body.daily_time if body.daily_time is not None else novel["daily_time"]
        db.set_auto_generate(novel_id, enabled, sched_time)
        if enabled:
            scheduler_module.schedule_novel(novel_id, sched_time)
        else:
            scheduler_module.unschedule_novel(novel_id)
    if body.provider is not None:
        db.set_provider(novel_id, body.provider)
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
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    chapter = db.get_chapter(novel_id, chapter_num)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter

@app.put("/api/novels/{novel_id}/chapters/{chapter_num}", response_model=ChapterResponse)
def update_chapter(novel_id: str, chapter_num: int, body: ChapterUpdate, db: DB):
    if not db.get_novel(novel_id):
        raise HTTPException(status_code=404, detail="Novel not found")
    db.save_chapter_content(novel_id, chapter_num, body.content)
    return db.get_chapter(novel_id, chapter_num)

@app.post("/api/novels/{novel_id}/chapters/{chapter_num}/generate")
async def generate_chapter(novel_id: str, chapter_num: int, db: DB):
    novel = db.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    provider = novel.get("provider", "anthropic")
    mm = MemoryManager(novel_id=novel_id, provider=provider)
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
