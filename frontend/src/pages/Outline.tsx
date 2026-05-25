// frontend/src/pages/Outline.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Outline, Novel } from '../api/types'

export default function OutlinePage() {
  const { novelId } = useParams<{ novelId: string }>()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [outlines, setOutlines] = useState<Outline[]>([])
  const [newChapterNum, setNewChapterNum] = useState(1)
  const [newOutlineText, setNewOutlineText] = useState('')

  const [genStart, setGenStart] = useState(1)
  const [genCount, setGenCount] = useState(20)
  const [generating, setGenerating] = useState(false)
  const [genLog, setGenLog] = useState<string[]>([])

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.outlines.list(novelId).then(os => {
      setOutlines(os)
      if (os.length > 0) {
        const max = Math.max(...os.map(o => o.chapter_num))
        setGenStart(max + 1)
        setNewChapterNum(max + 1)
      }
    }).catch(console.error)
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

  async function handleGenerate() {
    if (!novelId || generating) return
    setGenerating(true)
    setGenLog([])
    await api.outlines.generate(
      novelId,
      genStart,
      genCount,
      msg => setGenLog(prev => [...prev, msg]),
      count => {
        setGenLog(prev => [...prev, `✓ 已生成 ${count} 章大纲`])
        setGenerating(false)
        api.outlines.list(novelId!).then(os => {
          setOutlines(os)
          const max = Math.max(...os.map(o => o.chapter_num))
          setGenStart(max + 1)
        }).catch(console.error)
      },
      err => {
        setGenLog(prev => [...prev, `错误: ${err}`])
        setGenerating(false)
      }
    )
  }

  const title = novel?.title ?? '…'

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="outline">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-100">章节大纲</h1>

        {/* AI Generate Panel */}
        <div className="bg-surface border border-rim rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">AI 生成大纲</h2>
              <p className="text-xs text-slate-500 mt-0.5">根据世界观和角色自动生成章节大纲</p>
            </div>
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? '生成中…' : 'AI 生成'}
            </button>
          </div>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">从第几章开始</label>
              <input
                type="number"
                min={1}
                value={genStart}
                onChange={e => setGenStart(Number(e.target.value))}
                disabled={generating}
                className="w-20 bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">生成章节数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={genCount}
                onChange={e => setGenCount(Number(e.target.value))}
                disabled={generating}
                className="w-20 bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
              />
            </div>
          </div>
          {genLog.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-rim">
              {genLog.map((log, i) => (
                <p key={i} className="text-xs text-slate-400">{log}</p>
              ))}
            </div>
          )}
        </div>

        {outlines.length === 0 && !generating && (
          <p className="text-slate-600 text-sm">暂无大纲，点击「AI 生成」自动创建，或手动添加</p>
        )}

        {outlines.length > 0 && (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rim">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-16">章节</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">大纲</th>
                </tr>
              </thead>
              <tbody>
                {outlines.map(o => (
                  <tr key={o.chapter_num} className="border-b border-rim last:border-0">
                    <td className="px-4 py-2 font-mono text-sm text-slate-400">{o.chapter_num}</td>
                    <td className="px-2 py-1">
                      <textarea
                        className="w-full bg-transparent text-sm text-slate-300 px-2 py-1 resize-none focus:outline-none focus:bg-surface-hover rounded transition-colors"
                        rows={2}
                        defaultValue={o.outline}
                        onBlur={e => handleUpsert(o.chapter_num, e.target.value).catch(console.error)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Manual add */}
        <div className="bg-surface border border-rim rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-400">手动添加</p>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-500">第</span>
            <input
              type="number"
              min={1}
              value={newChapterNum}
              onChange={e => setNewChapterNum(Number(e.target.value))}
              className="w-16 bg-base border border-rim rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <span className="text-sm text-slate-500">章</span>
          </div>
          <textarea
            className="w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 h-20 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="大纲内容…"
            value={newOutlineText}
            onChange={e => setNewOutlineText(e.target.value)}
          />
          <button
            className="bg-surface-hover border border-rim text-slate-300 px-3 py-1.5 rounded-lg text-sm hover:border-indigo-500/50 disabled:opacity-40 transition-colors"
            disabled={!newOutlineText.trim()}
            onClick={() => handleAddNew().catch(console.error)}
          >
            添加
          </button>
        </div>
      </div>
    </Layout>
  )
}
