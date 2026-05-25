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
  const [totalChapters, setTotalChapters] = useState(0)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(setNovel).catch(console.error)
    api.chapters.list(novelId).then(chs =>
      setTotalChapters(chs.length > 0 ? Math.max(...chs.map(c => c.chapter_num)) : 0)
    ).catch(console.error)
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

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
          setStatus('已完成')
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
    if (!novelId || isSaving) return
    setIsSaving(true)
    try {
      const updated = await api.chapters.update(novelId, chapterNum, editContent)
      setChapter(updated)
      setEditing(false)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const title = novel?.title ?? '…'

  const toolbar = (
    <div className="flex items-center gap-2">
      {status && (
        <span className={`text-sm ${status.startsWith('错误') || status.startsWith('保存失败') ? 'text-red-400' : 'text-emerald-400'}`}>
          {status}
        </span>
      )}
      {!editing && !isGenerating && (
        <button
          className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
          onClick={() => setFocusMode(v => !v)}
        >
          {focusMode ? '退出专注' : '专注模式'}
        </button>
      )}
      {!editing && (
        <button
          className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover disabled:opacity-40 transition-colors"
          disabled={isGenerating}
          onClick={() => setEditing(true)}
        >
          编辑
        </button>
      )}
      {editing && (
        <>
          <button
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
            disabled={isSaving}
            onClick={handleSave}
          >
            保存
          </button>
          <button
            className="border border-rim text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
            onClick={() => { setEditing(false); setEditContent(chapter?.content ?? '') }}
          >
            取消
          </button>
        </>
      )}
      <button
        className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-40 transition-all"
        disabled={isGenerating}
        onClick={handleRegenerate}
      >
        {isGenerating ? '生成中…' : '重新生成'}
      </button>
    </div>
  )

  const meta = chapter && (
    <div className="flex gap-4 text-sm text-slate-600">
      <span>{chapter.content.length} 字</span>
      {chapter.summary && <span className="truncate max-w-md">· {chapter.summary}</span>}
    </div>
  )

  const contentArea = editing ? (
    <textarea
      className="w-full bg-base border border-rim rounded-xl px-6 py-5 h-[65vh] text-slate-200 leading-7 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
      value={editContent}
      onChange={e => setEditContent(e.target.value)}
    />
  ) : (
    <div
      ref={contentRef}
      className={`w-full border border-rim rounded-xl px-6 py-5 h-[65vh] overflow-y-auto bg-surface text-slate-200 leading-7 whitespace-pre-wrap ${
        focusMode ? 'font-serif text-lg leading-8 max-w-2xl mx-auto' : ''
      }`}
    >
      {chapter?.content || <span className="text-slate-700">（暂无内容）</span>}
      {isGenerating && <span className="inline-block w-0.5 h-5 bg-indigo-400 animate-pulse ml-1 align-middle" />}
    </div>
  )

  const prevNext = (
    <div className="flex justify-between text-sm">
      {chapterNum > 1 ? (
        <button
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum - 1}`)}
        >
          ← 第 {chapterNum - 1} 章
        </button>
      ) : <span />}
      {chapterNum < totalChapters ? (
        <button
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
          onClick={() => navigate(`/novels/${novelId}/chapters/${chapterNum + 1}`)}
        >
          第 {chapterNum + 1} 章 →
        </button>
      ) : <span />}
    </div>
  )

  if (focusMode) {
    return (
      <div className="min-h-screen bg-[#080810] text-slate-200">
        <header className="fixed top-0 inset-x-0 h-12 bg-[#080810] border-b border-rim flex items-center justify-between px-8 z-50">
          <span className="text-sm text-slate-500">{title} · 第 {chapterNum} 章</span>
          <div className="flex items-center gap-4">
            {toolbar}
          </div>
        </header>
        <main className="pt-16 pb-16 px-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {meta}
            {contentArea}
            {prevNext}
          </div>
        </main>
      </div>
    )
  }

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="chapters">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">第 {chapterNum} 章</h1>
          {toolbar}
        </div>
        {meta}
        {contentArea}
        {prevNext}
      </div>
    </Layout>
  )
}
