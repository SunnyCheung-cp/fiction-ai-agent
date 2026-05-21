// frontend/src/pages/NovelSettings.tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { api } from '../api/client'
import type { Character, Novel } from '../api/types'

export default function NovelSettings() {
  const { novelId } = useParams<{ novelId: string }>()

  const [novel, setNovel] = useState<Novel | null>(null)
  const [worldBible, setWorldBible] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [charProfiles, setCharProfiles] = useState<Record<string, string>>({})
  const [newCharName, setNewCharName] = useState('')
  const [newCharProfile, setNewCharProfile] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setNovel(n)
      setWorldBible(n.world_bible)
      setAutoGenerate(n.auto_generate)
      setDailyTime(n.daily_time ?? '08:00')
    }).catch(console.error)
    api.characters.list(novelId).then(chars => {
      setCharacters(chars)
      setCharProfiles(Object.fromEntries(chars.map(c => [c.id, c.profile])))
    }).catch(console.error)
  }, [novelId])

  async function handleSaveAll() {
    if (!novelId) return
    setSaving(true)
    setStatus('')
    try {
      await api.novels.update(novelId, {
        world_bible: worldBible,
        auto_generate: autoGenerate,
        daily_time: dailyTime,
      })
      setStatus('设定已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCharacter() {
    if (!novelId || !newCharName || !newCharProfile) return
    setSaving(true)
    try {
      const char = await api.characters.create(novelId, newCharName, newCharProfile)
      setCharacters(prev => [...prev, char])
      setCharProfiles(prev => ({ ...prev, [char.id]: char.profile }))
      setNewCharName('')
      setNewCharProfile('')
    } catch {
      setStatus('添加角色失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateChar(charId: string, profile: string) {
    if (!novelId) return
    await api.characters.update(novelId, charId, profile).catch(console.error)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  const title = novel?.title ?? '…'

  return (
    <Layout breadcrumbs={[
      { label: '小说列表', href: '/novels' },
      { label: title, href: `/novels/${novelId}` },
      { label: '设定' },
    ]}>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">{title} — 设定</h1>

        {/* World Bible */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">世界观 / 故事圣经</h2>
          <textarea
            className="w-full border rounded px-3 py-2 h-40"
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </section>

        {/* Auto generation */}
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">自动生成设置</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="autoGen">开启每日自动生章</label>
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
        </section>

        {/* Save world bible + auto gen together */}
        <div className="flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
            disabled={saving}
            onClick={handleSaveAll}
          >
            保存设定
          </button>
          {status && (
            <span className={`text-sm ${status.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>
              {status}
            </span>
          )}
        </div>

        {/* Characters */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">角色档案</h2>
          {characters.map(c => (
            <div key={c.id} className="border rounded p-3 space-y-2">
              <div className="font-medium">{c.name}</div>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm h-20"
                value={charProfiles[c.id] ?? c.profile}
                onChange={e => setCharProfiles(prev => ({ ...prev, [c.id]: e.target.value }))}
                onBlur={e => handleUpdateChar(c.id, e.target.value).catch(console.error)}
              />
            </div>
          ))}
          <div className="border rounded p-3 space-y-2 bg-gray-50">
            <div className="font-medium text-gray-600">添加新角色</div>
            <input
              className="w-full border rounded px-2 py-1"
              placeholder="角色名"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
            />
            <textarea
              className="w-full border rounded px-2 py-1 h-20"
              placeholder="角色档案描述"
              value={newCharProfile}
              onChange={e => setNewCharProfile(e.target.value)}
            />
            <button
              className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              disabled={!newCharName || !newCharProfile || saving}
              onClick={() => handleAddCharacter().catch(console.error)}
            >
              添加
            </button>
          </div>
        </section>
      </div>
    </Layout>
  )
}
