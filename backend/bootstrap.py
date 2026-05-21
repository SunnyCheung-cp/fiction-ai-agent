# backend/bootstrap.py
import json
import logging
import os

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


async def generate_world_bible(title: str, genre_hint: str = "") -> str:
    genre_line = f"\n类型提示：{genre_hint}" if genre_hint else ""
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说标题，创作一个引人入胜的世界观设定。

小说标题：{title}{genre_line}

请创作包含以下内容的世界观设定（500-800字）：
1. 故事背景和时代设定
2. 世界规则或特殊设定（如修炼体系、魔法系统、科技水平等）
3. 核心矛盾和主题
4. 整体故事基调

直接输出世界观内容，不要加标题或前言。"""

    response = await get_client().messages.create(
        model=HAIKU_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def generate_characters(title: str, world_bible: str) -> list[dict]:
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说信息，创作主要角色档案。

小说标题：{title}
世界观设定：{world_bible}

请创作3-5个主要角色。只返回JSON数组，不要其他内容：
[{{"name": "角色名", "profile": "200-300字的详细档案，包含外貌、性格、背景、定位"}}]"""

    response = await get_client().messages.create(
        model=HAIKU_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    start = text.find("[")
    end = text.rfind("]") + 1
    return json.loads(text[start:end])


async def generate_outlines(
    title: str, world_bible: str, characters: list[dict], count: int = 20
) -> list[dict]:
    char_summary = "\n".join(
        f"- {c['name']}: {c['profile'][:120]}…" for c in characters
    )
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说信息，创作前{count}章的详细大纲。

小说标题：{title}
世界观设定（节选）：{world_bible[:600]}
主要角色：
{char_summary}

请创作第1章到第{count}章的大纲，每章100-150字，保证完整的故事弧线，节奏紧凑，有悬念和起伏。

只返回JSON数组，不要其他内容：
[{{"chapter_num": 1, "outline": "大纲内容"}}]"""

    response = await get_client().messages.create(
        model=HAIKU_MODEL,
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    start = text.find("[")
    end = text.rfind("]") + 1
    return json.loads(text[start:end])
