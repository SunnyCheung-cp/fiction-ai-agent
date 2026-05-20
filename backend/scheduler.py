# backend/scheduler.py
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database import Database
from backend.memory_manager import MemoryManager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def schedule_novel(novel_id: str, daily_time: str):
    hour, minute = map(int, daily_time.split(":"))
    job_id = f"auto_gen_{novel_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(
        generate_next_chapter,
        CronTrigger(hour=hour, minute=minute),
        id=job_id,
        args=[novel_id],
        replace_existing=True,
    )


def unschedule_novel(novel_id: str):
    job_id = f"auto_gen_{novel_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


async def generate_next_chapter(novel_id: str):
    try:
        db = Database("data/novel.db")
        chapter_num = db.get_next_chapter_num(novel_id)
        mm = MemoryManager(novel_id=novel_id)
        context = mm.build_context(chapter_num=chapter_num, db=db)
        full_text = ""
        async for chunk in mm.engine.generate_chapter_stream(context):
            full_text += chunk
        db.save_chapter_content(novel_id, chapter_num, full_text)
        await mm.after_chapter_written(chapter_num=chapter_num, content=full_text, db=db)
        logger.info("Auto-generated chapter %d for novel %s", chapter_num, novel_id)
    except Exception as exc:
        logger.error("Auto-generation failed for novel %s: %s", novel_id, exc)
