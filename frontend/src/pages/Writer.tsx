import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

export default function Writer() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()

  const [chapterNum, setChapterNum] = useState(1)
  const [content, setContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [novelTitle, setNovelTitle] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => setNovelTitle(n.title)).catch(console.error)
  }, [novelId])

  useEffect(() => {
    if (!novelId) return
    api.chapters.get(novelId, chapterNum).then(ch => setContent(ch.content)).catch(console.error)
  }, [novelId, chapterNum])

  useEffect(() => {
    if (isGenerating && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, isGenerating])

  async function handleGenerate() {
    if (!novelId || isGenerating) return
    setIsGenerating(true)
    setContent('')
    setStatus('生成中...')

    try {
      await api.chapters.generateStream(
        novelId,
        chapterNum,
        chunk => setContent(prev => prev + chunk),
        () => {
          setIsGenerating(false)
          setStatus('生成完成，正在更新记忆...')
          setTimeout(() => setStatus(''), 3000)
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
      await api.chapters.update(novelId, chapterNum, content)
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
    }
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{novelTitle}</h1>
        <button
          className="text-sm text-gray-500 underline"
          onClick={() => navigate(`/outline/${novelId}`)}
        >
          ← 大纲
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="font-medium">第</label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-20"
          min={1}
          value={chapterNum}
          onChange={e => setChapterNum(Number(e.target.value))}
        />
        <label className="font-medium">章</label>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isGenerating}
          onClick={handleGenerate}
        >
          {isGenerating ? '生成中...' : '生成本章'}
        </button>
        <button
          className="bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isGenerating}
          onClick={handleSave}
        >
          保存编辑
        </button>
        {status && (
          <span className={`text-sm ${status.startsWith('错误') || status.startsWith('保存失败') ? 'text-red-600' : 'text-green-700'}`}>
            {status}
          </span>
        )}
      </div>

      <textarea
        ref={contentRef}
        className="w-full border rounded px-4 py-3 h-[65vh] font-mono text-sm leading-relaxed resize-none"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="点击「生成本章」开始写作，或直接在此输入..."
        disabled={isGenerating}
      />

      <div className="text-sm text-gray-400 text-right">
        {content.length} 字
      </div>
    </div>
  )
}
