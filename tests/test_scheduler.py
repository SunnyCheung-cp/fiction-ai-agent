# tests/test_scheduler.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.scheduler import schedule_novel, unschedule_novel, generate_next_chapter, scheduler


def test_schedule_novel_adds_job():
    schedule_novel("novel-123", "08:30")
    job = scheduler.get_job("auto_gen_novel-123")
    assert job is not None
    scheduler.remove_job("auto_gen_novel-123")


def test_schedule_novel_replaces_existing():
    schedule_novel("novel-abc", "08:00")
    schedule_novel("novel-abc", "10:00")
    jobs = [j for j in scheduler.get_jobs() if j.id == "auto_gen_novel-abc"]
    assert len(jobs) == 1
    scheduler.remove_job("auto_gen_novel-abc")


def test_unschedule_novel_removes_job():
    schedule_novel("novel-xyz", "09:00")
    unschedule_novel("novel-xyz")
    assert scheduler.get_job("auto_gen_novel-xyz") is None


def test_unschedule_nonexistent_does_not_raise():
    unschedule_novel("novel-does-not-exist")  # must not raise


@pytest.mark.asyncio
async def test_generate_next_chapter_calls_pipeline():
    mock_db = MagicMock()
    mock_db.get_next_chapter_num.return_value = 5

    async def fake_stream(ctx):
        yield "chunk1"
        yield "chunk2"

    mock_mm = MagicMock()
    mock_mm.build_context.return_value = "context"
    mock_mm.engine.generate_chapter_stream = fake_stream
    mock_mm.after_chapter_written = AsyncMock()

    with patch("backend.scheduler.Database", return_value=mock_db), \
         patch("backend.scheduler.MemoryManager", return_value=mock_mm):
        await generate_next_chapter("n1")

    mock_db.save_chapter_content.assert_called_once_with("n1", 5, "chunk1chunk2")
    mock_mm.after_chapter_written.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_next_chapter_handles_exception():
    mock_db = MagicMock()
    mock_db.get_next_chapter_num.side_effect = Exception("DB error")
    with patch("backend.scheduler.Database", return_value=mock_db):
        await generate_next_chapter("bad-novel")  # must not raise
