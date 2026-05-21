// frontend/src/api/types.ts
export interface Novel {
  id: string
  title: string
  world_bible: string
  created_at: string
  auto_generate: boolean
  daily_time: string
  provider: string
}

export interface Character {
  id: string
  novel_id: string
  name: string
  profile: string
}

export interface Outline {
  novel_id: string
  chapter_num: number
  outline: string
}

export interface Chapter {
  novel_id: string
  chapter_num: number
  content: string
  summary: string
}

export interface ChapterListItem {
  novel_id: string
  chapter_num: number
  word_count: number
  has_content: boolean
  summary: string
}

export interface RecentChapter {
  novel_id: string
  novel_title: string
  chapter_num: number
  created_at: string
}

export interface Stats {
  novel_count: number
  total_chapters: number
  auto_gen_count: number
  recent_chapters: RecentChapter[]
}
