import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Novel } from '../api/types'

export default function Home() {
  const navigate = useNavigate()
  const [novels, setNovels] = useState<Novel[]>([])

  useEffect(() => {
    api.novels.list().then(setNovels).catch(console.error)
  }, [])

  return (
    <div className="max-w-2xl mx-auto mt-16 p-6 space-y-6">
      <h1 className="text-3xl font-bold">AI 小说工坊</h1>

      <button
        className="bg-blue-600 text-white px-5 py-2 rounded text-lg"
        onClick={() => navigate('/setup')}
      >
        + 新建小说
      </button>

      {novels.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">已有小说</h2>
          {novels.map(n => (
            <div
              key={n.id}
              className="border rounded p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/write/${n.id}`)}
            >
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-gray-400">{n.created_at?.slice(0, 10)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm text-blue-600 underline"
                  onClick={e => { e.stopPropagation(); navigate(`/setup/${n.id}`) }}
                >
                  设定
                </button>
                <button
                  className="text-sm text-blue-600 underline"
                  onClick={e => { e.stopPropagation(); navigate(`/outline/${n.id}`) }}
                >
                  大纲
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
