// frontend/src/api/client.ts
import type { Novel, Character, Outline, Chapter } from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Novels
export const api = {
  novels: {
    list: () => req<Novel[]>('/novels'),
    get: (id: string) => req<Novel>(`/novels/${id}`),
    create: (title: string, world_bible: string) =>
      req<Novel>('/novels', { method: 'POST', body: JSON.stringify({ title, world_bible }) }),
    update: (id: string, world_bible: string) =>
      req<Novel>(`/novels/${id}`, { method: 'PUT', body: JSON.stringify({ world_bible }) }),
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
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError(parsed.error); return }
            if (parsed.text) onChunk(parsed.text)
          } catch {}
        }
      }
      onDone()
    },
  },
}
