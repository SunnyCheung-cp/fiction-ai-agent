// frontend/src/api/types.ts
export interface Novel {
  id: string
  title: string
  world_bible: string
  created_at: string
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
