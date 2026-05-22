// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CreateNovelModal from '../components/CreateNovelModal'
import { api } from '../api/client'
import type { Stats } from '../api/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.stats.get().then(setStats).catch(console.error)
  }, [])

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <div className="pt-8 pb-4 space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI 小说工坊
          </h1>
          <p className="text-slate-400 text-lg">输入标题，AI 自动构建世界观、角色与大纲</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-all shadow-[0_0_24px_rgba(99,102,241,0.35)] text-sm"
          >
            + 新建小说
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="小说总数" value={stats?.novel_count ?? '—'} icon="📖" />
          <StatCard label="已写章节" value={stats?.total_chapters ?? '—'} icon="✍️" />
          <StatCard label="自动生成中" value={stats?.auto_gen_count ?? '—'} icon="⚡" />
        </div>

        {/* Recent chapters */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-300">最近生成</h2>
          {(!stats?.recent_chapters || stats.recent_chapters.length === 0) && (
            <p className="text-slate-600 text-sm">暂无生成记录</p>
          )}
          <div className="space-y-2">
            {stats?.recent_chapters?.map(ch => (
              <div
                key={`${ch.novel_id}-${ch.chapter_num}`}
                className="bg-surface border border-rim rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:border-indigo-500/50 hover:bg-surface-hover transition-all group"
                onClick={() => navigate(`/novels/${ch.novel_id}/chapters/${ch.chapter_num}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-200">{ch.novel_title}</span>
                  <span className="text-slate-500 text-sm">第 {ch.chapter_num} 章</span>
                </div>
                <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
                  {ch.created_at.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        </section>

        <button
          className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          onClick={() => navigate('/novels')}
        >
          查看全部小说 →
        </button>
      </div>

      <CreateNovelModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Layout>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-surface border border-rim rounded-xl p-5 hover:border-indigo-500/40 transition-colors">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
