# backend/novel_engine.py
import os
import json
import anthropic
from dotenv import load_dotenv
from typing import AsyncIterator

load_dotenv()

WRITER_SYSTEM_PROMPT = """你是一位专业的中文网络小说作家，擅长写仙侠、玄幻、都市等类型的长篇小说。
你的写作风格：
- 情节紧凑，节奏感强
- 人物性格鲜明，对话自然
- 场景描写生动，代入感强
- 每章字数在1500-2500字之间
严格按照提供的世界观设定、角色档案和章节大纲来写作，保持角色性格和剧情的一致性。"""

HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

class NovelEngine:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )

    async def generate_chapter_stream(self, context: str) -> AsyncIterator[str]:
        async with self.client.messages.stream(
            model=SONNET_MODEL,
            max_tokens=3000,
            system=WRITER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": context}]
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def summarize(self, content: str) -> str:
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": f"请用100字以内概括以下章节的主要情节，只输出摘要，不要任何前缀：\n\n{content}"
            }]
        )
        return response.content[0].text.strip()

    async def extract_key_events(self, content: str) -> list[str]:
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": f"从以下章节中提取3-5个关键情节事件，每行一个，用「-」开头，只输出事件列表：\n\n{content}"
            }]
        )
        lines = response.content[0].text.strip().split('\n')
        return [line.lstrip('- ').strip() for line in lines if line.strip()]

    async def extract_char_updates(self, content: str, characters: list[dict]) -> dict[str, str]:
        if not characters:
            return {}
        char_names = [c["name"] for c in characters]
        response = await self.client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": (
                    f"分析以下章节中这些角色的状态变化：{', '.join(char_names)}\n\n"
                    f"章节内容：\n{content}\n\n"
                    "对于每个有明显状态变化的角色，用JSON格式输出 {\"角色名\": \"角色最新完整状态描述\"}。"
                    "如果角色无变化则不包含该角色。只输出JSON对象，不要其他文字。"
                )
            }]
        )
        try:
            updates_by_name = json.loads(response.content[0].text.strip())
            name_to_id = {c["name"]: c["id"] for c in characters}
            return {
                name_to_id[name]: profile
                for name, profile in updates_by_name.items()
                if name in name_to_id
            }
        except (json.JSONDecodeError, KeyError):
            return {}
