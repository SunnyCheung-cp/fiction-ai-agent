// frontend/src/pages/NovelList.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function NovelList() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])

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
    <Layout breadcrumbs={[{ label: '小说列表' }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">小说列表</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => navigate('/novels/new')}
          >
            + 新建小说
          </button>
        </div>

        {novels.length === 0 && (
          <p className="text-gray-400">暂无小说，点击「新建小说」开始创作</p>
        )}

        <div className="grid gap-4">
          {novels.map(n => (
            <div
              key={n.id}
              className="bg-white border rounded p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/novels/${n.id}`)}
            >
              <div className="space-y-1">
                <div className="font-semibold text-lg">{n.title}</div>
                <div className="text-sm text-gray-400">{n.created_at?.slice(0, 10)}</div>
              </div>
              <div className="flex items-center gap-3">
                {n.auto_generate ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    每日 {n.daily_time} 自动生成
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                    手动模式
                  </span>
                )}
                <button
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                  onClick={e => handleDelete(e, n.id, n.title)}
                >
                  删除
                </button>
                <span className="text-gray-400 text-sm">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
