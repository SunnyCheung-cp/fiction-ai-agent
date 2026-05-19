# tests/test_novel_engine.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.mark.asyncio
async def test_generate_chapter_stream_yields_text():
    from backend.novel_engine import NovelEngine

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_stream_ctx)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async def fake_text_stream():
        for chunk in ["这是", "第一章", "内容"]:
            yield chunk

    mock_stream_ctx.text_stream = fake_text_stream()

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = MagicMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.stream.return_value = mock_stream_ctx

        engine = NovelEngine()
        chunks = []
        async for chunk in engine.generate_chapter_stream("some context"):
            chunks.append(chunk)

    assert chunks == ["这是", "第一章", "内容"]

@pytest.mark.asyncio
async def test_summarize_returns_string():
    from backend.novel_engine import NovelEngine

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="这章主角突破了金丹期。")]

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = AsyncMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        engine = NovelEngine()
        summary = await engine.summarize("很长的章节内容...")

    assert isinstance(summary, str)
    assert len(summary) > 0

@pytest.mark.asyncio
async def test_extract_key_events_returns_list():
    from backend.novel_engine import NovelEngine

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="- 叶辰突破金丹\n- 师傅离去\n- 宗门大比开始")]

    with patch("backend.novel_engine.anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = AsyncMock()
        MockAnthropic.return_value = mock_client
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        engine = NovelEngine()
        events = await engine.extract_key_events("章节内容...")

    assert isinstance(events, list)
    assert len(events) >= 1
    assert all(isinstance(e, str) for e in events)
