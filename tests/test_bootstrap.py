# tests/test_bootstrap.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_generate_world_bible_returns_string():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="世界观内容测试")]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.bootstrap.get_client", return_value=mock_client):
        from backend.bootstrap import generate_world_bible
        result = await generate_world_bible("仙侠传", "仙侠")

    assert isinstance(result, str)
    assert len(result) > 0
    mock_client.messages.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_characters_returns_list():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(
        text='[{"name": "主角", "profile": "主角档案描述内容"}]'
    )]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.bootstrap.get_client", return_value=mock_client):
        from backend.bootstrap import generate_characters
        result = await generate_characters("仙侠传", "世界观内容")

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["name"] == "主角"
    assert "profile" in result[0]


@pytest.mark.asyncio
async def test_generate_outlines_returns_list():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(
        text='[{"chapter_num": 1, "outline": "第一章大纲"}, {"chapter_num": 2, "outline": "第二章大纲"}]'
    )]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    characters = [{"name": "主角", "profile": "主角档案"}]
    with patch("backend.bootstrap.get_client", return_value=mock_client):
        from backend.bootstrap import generate_outlines
        result = await generate_outlines("仙侠传", "世界观", characters, count=2)

    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["chapter_num"] == 1
    assert result[1]["chapter_num"] == 2


@pytest.mark.asyncio
async def test_generate_characters_handles_json_with_prefix():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(
        text='Here are the characters:\n[{"name": "角色A", "profile": "档案A"}]'
    )]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.bootstrap.get_client", return_value=mock_client):
        from backend.bootstrap import generate_characters
        result = await generate_characters("测试", "设定")

    assert result[0]["name"] == "角色A"
