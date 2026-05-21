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
  const [showBootstrap, setShowBootstrap] = useState(false)
  const [bootstrapChapters, setBootstrapChapters] = useState(20)
  const [bootstrapGenre, setBootstrapGenre] = useState('')
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapLog, setBootstrapLog] = useState<string[]>([])

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.characters.list(novelId).then(setCharacters).catch(console.error)
    api.chapters.list(novelId).then(chs => setChapterCount(chs.filter(c => c.has_content).length)).catch(console.error)
    api.outlines.list(novelId).then(os => setOutlineCount(os.length)).catch(console.error)
  }, [novelId])

  async function handleDelete() {
    if (!novelId || !novel) return
    if (!window.confirm(`确定删除《${novel.title}》？所有章节和设定将永久删除。`)) return
    await api.novels.delete(novelId).catch(console.error)
    navigate('/novels')
  }

  async function handleBootstrap() {
    if (!novelId || bootstrapping) return
    setBootstrapping(true)
    setBootstrapLog([])
    try {
      await api.novels.bootstrap(
        novelId,
        bootstrapChapters,
        bootstrapGenre,
        msg => setBootstrapLog(prev => [...prev, msg]),
        summary => {
          setBootstrapLog(prev => [...prev, `✅ 完成：${summary.characters} 个角色，${summary.outlines} 章大纲`])
          setBootstrapping(false)
          setShowBootstrap(false)
          // Refresh data
          api.novels.get(novelId!).then(setNovel).catch(console.error)
          api.characters.list(novelId!).then(setCharacters).catch(console.error)
          api.chapters.list(novelId!).then(chs => setChapterCount(chs.filter(c => c.has_content).length)).catch(console.error)
          api.outlines.list(novelId!).then(os => setOutlineCount(os.length)).catch(console.error)
        },
        err => {
          setBootstrapLog(prev => [...prev, `❌ 错误: ${err}`])
          setBootstrapping(false)
        }
      )
    } catch (err) {
      setBootstrapLog(prev => [...prev, `❌ 错误: ${String(err)}`])
      setBootstrapping(false)
    }
  }

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
          <div className="flex flex-col items-end gap-2">
            {novel.auto_generate ? (
              <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full">
                每日 {novel.daily_time} 自动生成
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">手动模式</span>
            )}
            <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">
              {novel.provider === 'deepseek' ? 'DeepSeek' : 'Claude'}
            </span>
            <button
              className="text-xs text-red-400 hover:text-red-600 mt-1"
              onClick={handleDelete}
            >
              删除小说
            </button>
          </div>
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

        {/* Bootstrap panel */}
        <section className="border rounded p-4 bg-blue-50 border-blue-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-blue-800">AI 一键初始化</h2>
              <p className="text-xs text-blue-600 mt-0.5">自动生成世界观、角色档案和章节大纲</p>
            </div>
            <button
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={bootstrapping}
              onClick={() => setShowBootstrap(v => !v)}
            >
              {bootstrapping ? '初始化中…' : 'AI 初始化'}
            </button>
          </div>

          {showBootstrap && !bootstrapping && (
            <div className="space-y-3 pt-2 border-t border-blue-200">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-blue-800">生成章节数</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    className="border rounded px-2 py-1 w-20 text-sm"
                    value={bootstrapChapters}
                    onChange={e => setBootstrapChapters(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-medium text-blue-800">类型提示（可选）</label>
                  <input
                    type="text"
                    className="border rounded px-2 py-1 w-full text-sm"
                    placeholder="如：玄幻、都市、科幻…"
                    value={bootstrapGenre}
                    onChange={e => setBootstrapGenre(e.target.value)}
                  />
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
                  onClick={handleBootstrap}
                >
                  开始生成
                </button>
              </div>
            </div>
          )}

          {bootstrapLog.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-blue-200">
              {bootstrapLog.map((log, i) => (
                <p key={i} className="text-xs text-blue-700">{log}</p>
              ))}
            </div>
          )}
        </section>

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
