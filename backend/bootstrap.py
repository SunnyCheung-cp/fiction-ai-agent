# backend/bootstrap.py
import json
import logging
import os

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"
DEEPSEEK_MODEL = "deepseek-chat"

_anthropic_client: AsyncAnthropic | None = None
_deepseek_client: AsyncOpenAI | None = None


def get_anthropic_client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _anthropic_client


def get_deepseek_client() -> AsyncOpenAI:
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = AsyncOpenAI(
            api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com",
        )
    return _deepseek_client


async def _call(prompt: str, max_tokens: int, provider: str) -> str:
    if provider == "deepseek":
        response = await get_deepseek_client().chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()
    else:
        response = await get_anthropic_client().messages.create(
            model=HAIKU_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()


async def generate_world_bible(title: str, genre_hint: str = "", provider: str = "anthropic") -> str:
    genre_line = f"\n类型提示：{genre_hint}" if genre_hint else ""
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说标题，创作一个引人入胜的世界观设定。

小说标题：{title}{genre_line}

请创作包含以下内容的世界观设定（500-800字）：
1. 故事背景和时代设定
2. 世界规则或特殊设定（如修炼体系、魔法系统、科技水平等）
3. 核心矛盾和主题
4. 整体故事基调

直接输出世界观内容，不要加标题或前言。"""
    return await _call(prompt, 1024, provider)


async def generate_characters(title: str, world_bible: str, provider: str = "anthropic") -> list[dict]:
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说信息，创作主要角色档案。

小说标题：{title}
世界观设定（节选）：{world_bible[:600]}

请创作3-5个主要角色。只返回JSON数组，不要其他内容：
[{{"name": "角色名", "profile": "200-300字的详细档案，包含外貌、性格、背景、定位"}}]"""
    text = await _call(prompt, 2048, provider)
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        logger.error("generate_characters: no JSON array in response: %r", text[:300])
        raise ValueError("模型未返回有效JSON角色数据，请重试")
    return json.loads(text[start:end])


async def generate_outlines(
    title: str,
    world_bible: str,
    characters: list[dict],
    count: int = 20,
    provider: str = "anthropic",
    start_chapter: int = 1,
    existing_outlines: list[dict] | None = None,
) -> list[dict]:
    char_summary = "\n".join(
        f"- {c['name']}: {c['profile'][:120]}…" for c in characters
    )
    end_chapter = start_chapter + count - 1
    existing_section = ""
    if existing_outlines:
        previews = "\n".join(
            f"  第{o['chapter_num']}章：{o['outline'][:80]}…" for o in existing_outlines[-5:]
        )
        existing_section = f"\n已有大纲（最近几章，供衔接参考）：\n{previews}\n"
    prompt = f"""你是一位专业的网络小说策划编辑。根据以下小说信息，创作第{start_chapter}章到第{end_chapter}章的详细大纲。

小说标题：{title}
世界观设定（节选）：{world_bible[:600]}
主要角色：
{char_summary}{existing_section}

请创作第{start_chapter}章到第{end_chapter}章的大纲，每章100-150字，保证完整的故事弧线，节奏紧凑，有悬念和起伏。

只返回JSON数组，不要其他内容：
[{{"chapter_num": {start_chapter}, "outline": "大纲内容"}}]"""
    text = await _call(prompt, 6000, provider)
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        logger.error("generate_outlines: no JSON array in response: %r", text[:300])
        raise ValueError("模型未返回有效JSON大纲数据，请重试")
    return json.loads(text[start:end])


# Keep old get_client for backward compat with tests
def get_client() -> AsyncAnthropic:
    return get_anthropic_client()
