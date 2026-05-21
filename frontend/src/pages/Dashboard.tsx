// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Stats } from '../api/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.stats.get().then(setStats).catch(console.error)
  }, [])

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">控制台</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => navigate('/novels/new')}
          >
            + 新建小说
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="小说总数" value={stats?.novel_count ?? '—'} color="blue" />
          <StatCard label="已写章节" value={stats?.total_chapters ?? '—'} color="green" />
          <StatCard label="自动生成中" value={stats?.auto_gen_count ?? '—'} color="purple" />
        </div>

        {/* Recent chapters */}
        <section>
          <h2 className="text-lg font-semibold mb-3">最近生成</h2>
          {stats?.recent_chapters?.length === 0 && (
            <p className="text-gray-400 text-sm">暂无生成记录</p>
          )}
          <div className="space-y-2">
            {stats?.recent_chapters?.map((ch) => (
              <div
                key={`${ch.novel_id}-${ch.chapter_num}`}
                className="bg-white border rounded p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/novels/${ch.novel_id}/chapters/${ch.chapter_num}`)}
              >
                <div>
                  <span className="font-medium">{ch.novel_title}</span>
                  <span className="text-gray-400 ml-2">第 {ch.chapter_num} 章</span>
                </div>
                <span className="text-xs text-gray-400">{ch.created_at.slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick nav */}
        <section>
          <button
            className="text-blue-600 hover:underline text-sm"
            onClick={() => navigate('/novels')}
          >
            查看全部小说 →
          </button>
        </section>
      </div>
    </Layout>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }
  return (
    <div className={`border rounded p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  )
}
