// frontend/src/pages/ChapterDetail.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Chapter, Novel } from '../api/types'

export default function ChapterDetail() {
  const { novelId, num } = useParams<{ novelId: string; num: string }>()
  const navigate = useNavigate()
  const chapterNum = Number(num)

  const [novel, setNovel] = useState<Novel | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
  }, [novelId])

  useEffect(() => {
    if (!novelId || !chapterNum) return
    api.chapters.get(novelId, chapterNum).then(ch => {
      setChapter(ch)
      setEditContent(ch.content)
    }).catch(console.error)
  }, [novelId, chapterNum])

  useEffect(() => {
    if (isGenerating && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [chapter?.content, isGenerating])

  async function handleRegenerate() {
    if (!novelId || isGenerating) return
    setIsGenerating(true)
    setStatus('生成中…')
    setChapter(prev => prev ? { ...prev, content: '' } : null)
    setEditContent('')
    setEditing(false)

    try {
      await api.chapters.generateStream(
        novelId,
        chapterNum,
        chunk => {
          setChapter(prev => prev ? { ...prev, content: (prev.content || '') + chunk } : null)
          setEditContent(prev => prev + chunk)
        },
        () => {
          setIsGenerating(false)
          setStatus('生成完成，正在更新记忆…')
          setTimeout(() => setStatus(''), 3000)
          api.chapters.get(novelId!, chapterNum).then(ch => {
            setChapter(ch)
            setEditContent(ch.content)
          }).catch(console.error)
        },
        err => {
          setIsGenerating(false)
          setStatus(`错误: ${err}`)
        }
      )
    } catch (err) {
      setIsGenerating(false)
      setStatus(`错误: ${String(err)}`)
    }
  }

  async function handleSave() {
    if (!novelId) return
    try {
      const updated = await api.chapters.update(novelId, chapterNum, editContent)
      setChapter(updated)
      setEditing(false)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    }
  }

  const title = novel?.title ?? '…'

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '章节列表', href: `/novels/${novelId}/chapters` },
      { label: `第 ${chapterNum} 章` },
    ]}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">第 {chapterNum} 章</h1>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`text-sm ${status.startsWith('错误') || status.startsWith('保存失败') ? 'text-red-600' : 'text-green-600'}`}>
                {status}
              </span>
            )}
            {!editing && (
              <button
                className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={isGenerating}
                onClick={() => setEditing(true)}
              >
                编辑
              </button>
            )}
            {editing && (
              <>
                <button
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                  onClick={handleSave}
                >
                  保存
                </button>
                <button
                  className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                  onClick={() => { setEditing(false); setEditContent(chapter?.content ?? '') }}
                >
                  取消
                </button>
              </>
            )}
            <button
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={isGenerating}
              onClick={handleRegenerate}
            >
              {isGenerating ? '生成中…' : '重新生成'}
            </button>
          </div>
        </div>

        {/* Meta */}
        {chapter && (
          <div className="flex gap-4 text-sm text-gray-400">
            <span>{chapter.content.length} 字</span>
            {chapter.summary && <span>·</span>}
            {chapter.summary && <span className="truncate max-w-md">{chapter.summary}</span>}
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea
            ref={contentRef}
            className="w-full border rounded px-4 py-3 h-[70vh] font-mono text-sm leading-relaxed resize-none"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
          />
        ) : (
          <div
            ref={contentRef as unknown as React.RefObject<HTMLDivElement>}
            className="w-full border rounded px-4 py-3 h-[70vh] font-mono text-sm leading-relaxed overflow-y-auto bg-white whitespace-pre-wrap"
          >
            {chapter?.content || <span className="text-gray-300">（暂无内容）</span>}
          </div>
        )}

        {/* Prev / Next */}
        <div className="flex justify-between text-sm">
          {chapterNum > 1 ? (
            <button
              className="text-blue-600 hover:underline"
              onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum - 1}`)}
            >
              ← 第 {chapterNum - 1} 章
            </button>
          ) : <span />}
          <button
            className="text-blue-600 hover:underline"
            onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum + 1}`)}
          >
            第 {chapterNum + 1} 章 →
          </button>
        </div>
      </div>
    </Layout>
  )
}
