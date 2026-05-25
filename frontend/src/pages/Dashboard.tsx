// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CreateNovelModal from '../components/CreateNovelModal'
import { api } from '../api/client'
import type { Stats, RecentChapter } from '../api/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.stats.get().then(setStats).catch(console.error)
  }, [])

  // Group recent chapters by novel, keep last 5 chapters per novel, max 4 novels
  const novelGroups = groupByNovel(stats?.recent_chapters ?? [])

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <div className="pt-8 pb-2 space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI 小说工坊
          </h1>
          <p className="text-slate-400 text-base">输入标题，AI 自动构建世界观、角色与大纲，一键生成章节</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-all shadow-[0_0_24px_rgba(99,102,241,0.35)] text-sm"
            >
              + 新建小说
            </button>
            <button
              onClick={() => navigate('/novels')}
              className="border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              我的小说库 →
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="小说总数" value={stats?.novel_count ?? '—'} icon="📖" />
          <StatCard label="已写章节" value={stats?.total_chapters ?? '—'} icon="✍️" />
          <StatCard label="自动生成中" value={stats?.auto_gen_count ?? '—'} icon="⚡" />
        </div>

        {/* Recent by novel */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-300">最近创作</h2>
            {novelGroups.length > 0 && (
              <button
                onClick={() => navigate('/novels')}
                className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
              >
                查看全部 →
              </button>
            )}
          </div>

          {novelGroups.length === 0 && (
            <div className="bg-surface border border-rim rounded-xl p-8 text-center space-y-3">
              <p className="text-slate-500 text-sm">还没有创作记录</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
              >
                + 创建你的第一部小说
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {novelGroups.map(group => (
              <div key={group.novel_id} className="bg-surface border border-rim rounded-xl overflow-hidden hover:border-indigo-500/40 transition-colors">
                {/* Novel header */}
                <div
                  className="px-4 py-3 border-b border-rim flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => navigate(`/novels/${group.novel_id}/chapters`)}
                >
                  <span className="font-medium text-slate-100 text-sm truncate pr-2">{group.novel_title}</span>
                  <span className="text-xs text-indigo-400 shrink-0">继续写作 →</span>
                </div>
                {/* Chapter list */}
                <div className="divide-y divide-rim">
                  {group.chapters.map(ch => (
                    <div
                      key={ch.chapter_num}
                      className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors group"
                      onClick={() => navigate(`/novels/${group.novel_id}/chapters/${ch.chapter_num}`)}
                    >
                      <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                        第 {ch.chapter_num} 章
                      </span>
                      <span className="text-xs text-slate-600 group-hover:text-slate-500 transition-colors">
                        {ch.created_at.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <CreateNovelModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Layout>
  )
}

interface NovelGroup {
  novel_id: string
  novel_title: string
  chapters: RecentChapter[]
}

function groupByNovel(chapters: RecentChapter[]): NovelGroup[] {
  const map = new Map<string, NovelGroup>()
  for (const ch of chapters) {
    if (!map.has(ch.novel_id)) {
      map.set(ch.novel_id, { novel_id: ch.novel_id, novel_title: ch.novel_title, chapters: [] })
    }
    const group = map.get(ch.novel_id)!
    if (group.chapters.length < 5) group.chapters.push(ch)
  }
  return Array.from(map.values()).slice(0, 4)
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
