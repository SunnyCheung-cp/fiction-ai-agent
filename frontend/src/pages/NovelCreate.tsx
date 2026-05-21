// frontend/src/pages/NovelCreate.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'

export default function NovelCreate() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [worldBible, setWorldBible] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const novel = await api.novels.create({
        title,
        world_bible: worldBible,
        auto_generate: autoGenerate,
        ...(autoGenerate ? { daily_time: dailyTime } : {}),
      })
      navigate(`/novels/${novel.id}`)
    } catch {
      setError('创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout breadcrumbs={[{ label: '小说列表', href: '/novels' }, { label: '新建小说' }]}>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">新建小说</h1>

        <div className="space-y-2">
          <label className="block font-medium">小说标题 *</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="输入小说名称"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block font-medium">世界观设定</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-32"
            placeholder="描述故事背景、世界规则、核心设定…（可后续编辑）"
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </div>

        <div className="border rounded p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoGen" className="font-medium">开启每日自动生章</label>
          </div>
          {autoGenerate && (
            <div className="flex items-center gap-3 pl-7">
              <label className="text-sm text-gray-600">每天生成时间</label>
              <input
                type="time"
                className="border rounded px-2 py-1"
                value={dailyTime}
                onChange={e => setDailyTime(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
            disabled={!title.trim() || saving}
            onClick={handleCreate}
          >
            {saving ? '创建中…' : '创建小说'}
          </button>
          <button
            className="text-gray-500 px-4 py-2 rounded border hover:bg-gray-50"
            onClick={() => navigate('/novels')}
          >
            取消
          </button>
        </div>
      </div>
    </Layout>
  )
}
