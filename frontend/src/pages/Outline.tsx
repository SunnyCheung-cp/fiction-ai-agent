import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Outline } from '../api/types'

export default function OutlinePage() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [newChapterNum, setNewChapterNum] = useState(1)
  const [newOutlineText, setNewOutlineText] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.outlines.list(novelId).then(setOutlines).catch(console.error)
  }, [novelId])

  async function handleUpsert(chapterNum: number, text: string) {
    if (!novelId) return
    const updated = await api.outlines.upsert(novelId, chapterNum, text)
    setOutlines(prev => {
      const exists = prev.find(o => o.chapter_num === chapterNum)
      if (exists) return prev.map(o => o.chapter_num === chapterNum ? updated : o)
      return [...prev, updated].sort((a, b) => a.chapter_num - b.chapter_num)
    })
  }

  async function handleAddNew() {
    if (!newOutlineText.trim()) return
    await handleUpsert(newChapterNum, newOutlineText)
    setNewOutlineText('')
    setNewChapterNum(prev => prev + 1)
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 p-6 space-y-6">
      <h1 className="text-2xl font-bold">章节大纲</h1>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left w-16">章节</th>
            <th className="border px-3 py-2 text-left">大纲</th>
          </tr>
        </thead>
        <tbody>
          {outlines.map(o => (
            <tr key={o.chapter_num}>
              <td className="border px-3 py-2 text-center font-mono">{o.chapter_num}</td>
              <td className="border px-2 py-1">
                <textarea
                  className="w-full text-sm px-1 py-1 resize-none"
                  rows={2}
                  defaultValue={o.outline}
                  onBlur={e => handleUpsert(o.chapter_num, e.target.value).catch(console.error)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border rounded p-3 space-y-2 bg-gray-50">
        <div className="font-medium text-gray-600">添加章节大纲</div>
        <div className="flex gap-2 items-center">
          <label className="text-sm">第</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-16"
            value={newChapterNum}
            min={1}
            onChange={e => setNewChapterNum(Number(e.target.value))}
          />
          <label className="text-sm">章</label>
        </div>
        <textarea
          className="w-full border rounded px-2 py-1 h-20"
          placeholder="大纲内容..."
          value={newOutlineText}
          onChange={e => setNewOutlineText(e.target.value)}
        />
        <button
          className="bg-green-600 text-white px-3 py-1 rounded text-sm"
          onClick={() => handleAddNew().catch(console.error)}
        >
          添加
        </button>
      </div>

      <div className="flex gap-3">
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/setup/${novelId}`)}
        >
          ← 返回设定
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/write/${novelId}`)}
        >
          开始写作 →
        </button>
      </div>
    </div>
  )
}
