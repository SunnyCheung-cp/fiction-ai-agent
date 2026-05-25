// frontend/src/pages/NovelList.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CreateNovelModal from '../components/CreateNovelModal'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function NovelList() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.novels.list().then(setNovels).catch(console.error)
  }, [])

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation()
    if (!window.confirm(`确定删除《${title}》？此操作不可恢复。`)) return
    await api.novels.delete(id).catch(console.error)
    setNovels(prev => prev.filter(n => n.id !== id))
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-bold text-slate-100">我的小说</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-[0_0_16px_rgba(99,102,241,0.3)]"
          >
            + 新建小说
          </button>
        </div>

        {novels.length === 0 && (
          <p className="text-slate-600 text-sm pt-4">暂无小说，点击「新建小说」开始创作</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {novels.map(n => (
            <div
              key={n.id}
              className="bg-surface border border-rim rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 hover:bg-surface-hover transition-all group relative"
              onClick={() => navigate(`/novels/${n.id}/chapters`)}
            >
              <div className="pr-8 space-y-3">
                <div className="font-semibold text-slate-100 text-base leading-snug">{n.title}</div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-600">📖</span>
                    {n.chapter_count} 章
                  </span>
                  <span className="text-rim">·</span>
                  <span className="flex items-center gap-1">
                    <span className="text-slate-600">✍️</span>
                    {n.total_words > 0 ? formatWords(n.total_words) : '暂无内容'}
                  </span>
                  {n.updated_at && (
                    <>
                      <span className="text-rim">·</span>
                      <span>更新 {n.updated_at.slice(0, 10)}</span>
                    </>
                  )}
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-600">{n.created_at?.slice(0, 10)} 创建</span>
                  <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    {n.provider === 'deepseek' ? 'DeepSeek' : 'Claude'}
                  </span>
                  {n.auto_generate && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      每日 {n.daily_time}
                    </span>
                  )}
                </div>
              </div>

              <button
                className="absolute top-4 right-4 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none"
                onClick={e => handleDelete(e, n.id, n.title)}
                title="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <CreateNovelModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Layout>
  )
}

function formatWords(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 万字`
  return `${count} 字`
}
