// frontend/src/pages/NovelDetail.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Novel, Character } from '../api/types'

export default function NovelDetail() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [chapterCount, setChapterCount] = useState(0)
  const [outlineCount, setOutlineCount] = useState(0)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.characters.list(novelId).then(setCharacters).catch(console.error)
    api.chapters.list(novelId).then(chs => setChapterCount(chs.filter(c => c.has_content).length)).catch(console.error)
    api.outlines.list(novelId).then(os => setOutlineCount(os.length)).catch(console.error)
  }, [novelId])

  if (!novel) {
    return (
      <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }]}>
        <p className="text-gray-400">加载中…</p>
      </Layout>
    )
  }

  return (
    <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }, { label: novel.title }]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{novel.title}</h1>
            <p className="text-sm text-gray-400 mt-1">创建于 {novel.created_at?.slice(0, 10)}</p>
          </div>
          {novel.auto_generate ? (
            <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
              每日 {novel.daily_time} 自动生成
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">手动模式</span>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: '角色', value: characters.length },
            { label: '大纲章节', value: outlineCount },
            { label: '已写章节', value: chapterCount },
            { label: '自动生成', value: novel.auto_generate ? '开启' : '关闭' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded p-3">
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex gap-3 flex-wrap">
          <NavBtn label="章节列表" onClick={() => navigate(`/novels/${novelId}/chapters`)} primary />
          <NavBtn label="章节大纲" onClick={() => navigate(`/novels/${novelId}/outline`)} />
          <NavBtn label="设定" onClick={() => navigate(`/novels/${novelId}/settings`)} />
        </div>

        {/* Characters preview */}
        {characters.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">角色</h2>
            <div className="grid gap-3">
              {characters.map(c => (
                <div key={c.id} className="bg-white border rounded p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-500 mt-1 line-clamp-2">{c.profile}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* World bible preview */}
        {novel.world_bible && (
          <section>
            <h2 className="text-lg font-semibold mb-2">世界观</h2>
            <p className="text-sm text-gray-600 line-clamp-4 bg-white border rounded p-3">
              {novel.world_bible}
            </p>
          </section>
        )}
      </div>
    </Layout>
  )
}

function NavBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      className={`px-5 py-2 rounded font-medium ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border hover:bg-gray-50'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
