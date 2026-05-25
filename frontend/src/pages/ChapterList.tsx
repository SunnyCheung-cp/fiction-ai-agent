// frontend/src/pages/ChapterList.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { ChapterListItem, Novel } from '../api/types'

type BootstrapStep = 'idle' | 'world_bible' | 'characters' | 'outlines' | 'done' | 'error'

const STEP_LABELS: Record<string, string> = {
  world_bible: '世界观设定',
  characters: '角色档案',
  outlines: '章节大纲',
}
const STEP_ORDER: BootstrapStep[] = ['world_bible', 'characters', 'outlines']

export default function ChapterList() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [novel, setNovel] = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<ChapterListItem[]>([])
  const [generatingNum, setGeneratingNum] = useState<number | null>(null)
  const [streamStatus, setStreamStatus] = useState('')

  // Bootstrap state
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapStep, setBootstrapStep] = useState<BootstrapStep>('idle')
  const [bootstrapLog, setBootstrapLog] = useState('')
  const [bootstrapError, setBootstrapError] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)

    const autoInit = searchParams.get('auto_init') === '1'
    const initChapters = Number(searchParams.get('init_chapters') ?? '20')
    const initGenre = searchParams.get('init_genre') ?? ''

    api.outlines.list(novelId).then(outlines => {
      if (autoInit && outlines.length === 0) {
        // Inline bootstrap start to avoid stale closure from external function ref
        setBootstrapping(true)
        setBootstrapStep('world_bible')
        setBootstrapError('')
        api.novels.bootstrap(
          novelId,
          initChapters,
          initGenre,
          msg => setBootstrapLog(msg),
          step => setBootstrapStep(step),
          () => {
            setBootstrapStep('done')
            setBootstrapping(false)
            api.chapters.list(novelId).then(setChapters).catch(console.error)
          },
          err => {
            setBootstrapError(err)
            setBootstrapping(false)
          }
        )
      } else {
        api.chapters.list(novelId).then(setChapters).catch(console.error)
      }
    }).catch(console.error)
  }, [novelId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(chapterNum: number) {
    if (!novelId || generatingNum !== null) return
    setGeneratingNum(chapterNum)
    setStreamStatus('生成中…')
    try {
      await api.chapters.generateStream(
        novelId,
        chapterNum,
        () => {},
        () => {
          setGeneratingNum(null)
          setStreamStatus('')
          api.chapters.list(novelId!).then(setChapters).catch(console.error)
        },
        err => {
          setGeneratingNum(null)
          setStreamStatus(`错误: ${err}`)
        }
      )
    } catch (err) {
      setGeneratingNum(null)
      setStreamStatus(`错误: ${String(err)}`)
    }
  }

  function getNextUnwritten(): number {
    if (chapters.length === 0) return 1
    const unwritten = chapters.find(c => !c.has_content)
    if (unwritten) return unwritten.chapter_num
    return Math.max(...chapters.map(c => c.chapter_num)) + 1
  }

  const title = novel?.title ?? '…'

  // Bootstrap in progress — show animated step view
  if (bootstrapping || bootstrapStep === 'done') {
    return (
      <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-sm">
              {bootstrapStep === 'done' ? '初始化完成' : 'AI 正在构建你的故事世界'}
            </p>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {title}
            </h2>
          </div>

          <div className="w-full max-w-sm space-y-4">
            {STEP_ORDER.map((step, idx) => {
              const currentIdx = STEP_ORDER.indexOf(bootstrapStep as BootstrapStep)
              const isDone = bootstrapStep === 'done' || idx < currentIdx
              const isActive = step === bootstrapStep
              return (
                <div key={step} className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    isDone
                      ? 'bg-indigo-500 text-white'
                      : isActive
                      ? 'bg-indigo-500/20 border border-indigo-500 text-indigo-400 animate-pulse'
                      : 'bg-surface border border-rim text-slate-600'
                  }`}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isDone ? 'text-slate-300' : isActive ? 'text-indigo-300' : 'text-slate-600'}`}>
                      {STEP_LABELS[step]}
                    </div>
                    {isActive && bootstrapLog && (
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{bootstrapLog}</div>
                    )}
                  </div>
                  {isActive && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />}
                </div>
              )
            })}
          </div>

          {bootstrapStep === 'done' && (
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              onClick={() => setBootstrapStep('idle')}
            >
              开始写作 →
            </button>
          )}
        </div>
      </Layout>
    )
  }

  if (bootstrapError) {
    return (
      <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
          <p className="text-red-400">初始化失败：{bootstrapError}</p>
          <button
            className="text-sm text-indigo-400 hover:text-indigo-300"
            onClick={() => { setBootstrapError(''); api.chapters.list(novelId!).then(setChapters).catch(console.error) }}
          >
            跳过，手动配置 →
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">章节列表</h1>
          <div className="flex items-center gap-3">
            {streamStatus && (
              <span className={`text-sm ${streamStatus.startsWith('错误') ? 'text-red-400' : 'text-emerald-400'}`}>
                {streamStatus}
              </span>
            )}
            <button
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
              disabled={generatingNum !== null}
              onClick={() => handleGenerate(getNextUnwritten())}
            >
              {generatingNum !== null ? `生成第 ${generatingNum} 章…` : '生成下一章'}
            </button>
          </div>
        </div>

        {chapters.length === 0 && (
          <p className="text-slate-600 text-sm">暂无章节。请先在「章节大纲」中添加大纲，然后点击「生成下一章」。</p>
        )}

        {chapters.length > 0 && (
          <div className="bg-surface border border-rim rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rim">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-16">章节</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-36">标题</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-20">状态</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium w-20">字数</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium">摘要</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map(ch => (
                  <tr key={ch.chapter_num} className="border-b border-rim last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-slate-300">{ch.chapter_num}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-[9rem] truncate" title={ch.title}>
                      {ch.title || <span className="text-slate-600 italic">待生成</span>}
                    </td>
                    <td className="px-4 py-3">
                      {ch.has_content ? (
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">已写</span>
                      ) : (
                        <span className="text-xs bg-slate-800 text-slate-500 border border-rim px-2 py-0.5 rounded-full">未写</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{ch.word_count > 0 ? ch.word_count : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{ch.summary || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      {ch.has_content && (
                        <button
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                          onClick={() => navigate(`/novels/${novelId}/chapters/${ch.chapter_num}`)}
                        >
                          查看
                        </button>
                      )}
                      <button
                        className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
                        disabled={generatingNum !== null}
                        onClick={() => handleGenerate(ch.chapter_num)}
                      >
                        {ch.has_content ? '重写' : '生成'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
