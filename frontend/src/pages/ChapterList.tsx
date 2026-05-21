// frontend/src/pages/ChapterList.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { ChapterListItem, Novel } from '../api/types'

export default function ChapterList() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<ChapterListItem[]>([])
  const [generatingNum, setGeneratingNum] = useState<number | null>(null)
  const [streamStatus, setStreamStatus] = useState('')
  const abortRef = useRef(false)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.chapters.list(novelId).then(setChapters).catch(console.error)
  }, [novelId])

  async function handleGenerate(chapterNum: number) {
    if (!novelId || generatingNum !== null) return
    abortRef.current = false
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

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '章节列表' },
    ]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">章节列表</h1>
          <div className="flex items-center gap-3">
            {streamStatus && (
              <span className={`text-sm ${streamStatus.startsWith('错误') ? 'text-red-600' : 'text-green-600'}`}>
                {streamStatus}
              </span>
            )}
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
              disabled={generatingNum !== null}
              onClick={() => handleGenerate(getNextUnwritten())}
            >
              {generatingNum !== null ? `生成第 ${generatingNum} 章…` : '生成下一章'}
            </button>
          </div>
        </div>

        {chapters.length === 0 && (
          <p className="text-gray-400">暂无章节。请先在「章节大纲」中添加大纲，然后点击「生成下一章」。</p>
        )}

        <table className="w-full border-collapse bg-white rounded border overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b px-4 py-2 text-left w-16">章节</th>
              <th className="border-b px-4 py-2 text-left w-20">状态</th>
              <th className="border-b px-4 py-2 text-left w-20">字数</th>
              <th className="border-b px-4 py-2 text-left">摘要</th>
              <th className="border-b px-4 py-2 text-right w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map(ch => (
              <tr key={ch.chapter_num} className="hover:bg-gray-50">
                <td className="border-b px-4 py-2 font-mono">{ch.chapter_num}</td>
                <td className="border-b px-4 py-2">
                  {ch.has_content ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已写</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">未写</span>
                  )}
                </td>
                <td className="border-b px-4 py-2 text-sm text-gray-500">{ch.word_count > 0 ? ch.word_count : '—'}</td>
                <td className="border-b px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                  {ch.summary || '—'}
                </td>
                <td className="border-b px-4 py-2 text-right space-x-2">
                  {ch.has_content && (
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => navigate(`/novels/${novelId}/chapters/${ch.chapter_num}`)}
                    >
                      查看
                    </button>
                  )}
                  <button
                    className="text-sm text-blue-600 hover:underline disabled:opacity-40"
                    disabled={generatingNum !== null}
                    onClick={() => handleGenerate(ch.chapter_num)}
                  >
                    {ch.has_content ? '重新生成' : '生成'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
