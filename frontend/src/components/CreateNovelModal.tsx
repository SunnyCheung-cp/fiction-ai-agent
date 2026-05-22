// frontend/src/components/CreateNovelModal.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function CreateNovelModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [genreHint, setGenreHint] = useState('')
  const [chapters, setChapters] = useState(20)
  const [provider, setProvider] = useState<'anthropic' | 'deepseek'>('anthropic')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setTitle('')
    setGenreHint('')
    setChapters(20)
    setProvider('anthropic')
    setShowAdvanced(false)
    setCreating(false)
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!title.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const novel = await api.novels.create({ title: title.trim(), provider })
      const params = new URLSearchParams({ auto_init: '1', init_chapters: String(chapters) })
      if (genreHint.trim()) params.set('init_genre', genreHint.trim())
      handleClose()
      navigate(`/novels/${novel.id}/chapters?${params}`)
    } catch {
      setError('创建失败，请重试')
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-surface border border-rim rounded-2xl p-8 w-full max-w-md mx-4 space-y-6">
        <h2 className="text-xl font-semibold text-slate-100">你的故事叫什么名字？</h2>

        <input
          autoFocus
          type="text"
          placeholder="输入小说标题…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-base border border-rim rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />

        <div>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? '▾' : '▸'} 可选配置
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">类型提示</label>
                <input
                  type="text"
                  placeholder="如：玄幻、都市、科幻…"
                  value={genreHint}
                  onChange={e => setGenreHint(e.target.value)}
                  className="w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">章节大纲数</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={chapters}
                  onChange={e => setChapters(Number(e.target.value))}
                  className="w-24 bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">AI 模型</label>
                <div className="flex gap-4">
                  {(['anthropic', 'deepseek'] as const).map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modal-provider"
                        checked={provider === p}
                        onChange={() => setProvider(p)}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-slate-300">
                        {p === 'anthropic' ? 'Claude' : 'DeepSeek'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 border border-rim text-slate-400 rounded-lg py-2.5 text-sm hover:bg-surface-hover transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || creating}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:shadow-none"
          >
            {creating ? '创建中…' : '开始创作 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
