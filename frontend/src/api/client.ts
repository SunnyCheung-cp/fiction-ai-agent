// frontend/src/api/client.ts
import type { Novel, Character, Outline, Chapter, ChapterListItem, Stats } from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  stats: {
    get: () => req<Stats>('/stats'),
  },
  novels: {
    list: () => req<Novel[]>('/novels'),
    get: (id: string) => req<Novel>(`/novels/${id}`),
    create: (body: { title: string; world_bible?: string; auto_generate?: boolean; daily_time?: string }) =>
      req<Novel>('/novels', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { world_bible?: string; auto_generate?: boolean; daily_time?: string }) =>
      req<Novel>(`/novels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  characters: {
    list: (novelId: string) => req<Character[]>(`/novels/${novelId}/characters`),
    create: (novelId: string, name: string, profile: string) =>
      req<Character>(`/novels/${novelId}/characters`, {
        method: 'POST',
        body: JSON.stringify({ name, profile }),
      }),
    update: (novelId: string, charId: string, profile: string) =>
      req<Character>(`/novels/${novelId}/characters/${charId}`, {
        method: 'PUT',
        body: JSON.stringify({ profile }),
      }),
  },
  outlines: {
    list: (novelId: string) => req<Outline[]>(`/novels/${novelId}/outlines`),
    upsert: (novelId: string, chapter_num: number, outline: string) =>
      req<Outline>(`/novels/${novelId}/outlines`, {
        method: 'POST',
        body: JSON.stringify({ chapter_num, outline }),
      }),
  },
  chapters: {
    list: (novelId: string) => req<ChapterListItem[]>(`/novels/${novelId}/chapters`),
    get: (novelId: string, num: number) => req<Chapter>(`/novels/${novelId}/chapters/${num}`),
    update: (novelId: string, num: number, content: string) =>
      req<Chapter>(`/novels/${novelId}/chapters/${num}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    generateStream: async (
      novelId: string,
      num: number,
      onChunk: (text: string) => void,
      onDone: () => void,
      onError: (err: string) => void
    ) => {
      const res = await fetch(`${BASE}/novels/${novelId}/chapters/${num}/generate`, {
        method: 'POST',
      })
      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6)
            if (payload === '[DONE]') { onDone(); return }
            try {
              const parsed = JSON.parse(payload)
              if (parsed.error) { onError(parsed.error); return }
              if (parsed.text) onChunk(parsed.text)
            } catch (e) {
              console.warn('SSE parse error', e, payload)
            }
          }
        }
      } catch (e) {
        onError(String(e))
        return
      }
      onDone()
    },
  },
}
