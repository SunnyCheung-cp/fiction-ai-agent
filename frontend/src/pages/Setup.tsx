import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Character } from '../api/types'

export default function Setup() {
  const { novelId } = useParams<{ novelId: string }>()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [worldBible, setWorldBible] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [charProfiles, setCharProfiles] = useState<Record<string, string>>({})
  const [newCharName, setNewCharName] = useState('')
  const [newCharProfile, setNewCharProfile] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setTitle(n.title)
      setWorldBible(n.world_bible)
    }).catch(console.error)
    api.characters.list(novelId).then(chars => {
      setCharacters(chars)
      setCharProfiles(Object.fromEntries(chars.map(c => [c.id, c.profile])))
    }).catch(console.error)
  }, [novelId])

  async function handleSaveWorldBible() {
    if (!novelId) return
    setSaving(true)
    try {
      await api.novels.update(novelId, worldBible)
      setStatus('世界观已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateNovel() {
    setSaving(true)
    try {
      const novel = await api.novels.create(title, worldBible)
      navigate(`/setup/${novel.id}`)
    } catch {
      setStatus('创建失败，请重试')
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
    await api.characters.update(novelId, charId, profile)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  if (!novelId) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 space-y-4">
        <h1 className="text-2xl font-bold">新建小说</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="小说标题"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="w-full border rounded px-3 py-2 h-32"
          placeholder="世界观设定（可后续编辑）"
          value={worldBible}
          onChange={e => setWorldBible(e.target.value)}
        />
        {status && <span className="text-red-600 text-sm">{status}</span>}
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!title || saving}
          onClick={handleCreateNovel}
        >
          创建小说
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 space-y-8">
      <h1 className="text-2xl font-bold">{title} — 设定</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">世界观 / 故事圣经</h2>
        <textarea
          className="w-full border rounded px-3 py-2 h-40"
          value={worldBible}
          onChange={e => setWorldBible(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={saving}
            onClick={handleSaveWorldBible}
          >
            保存
          </button>
          {status && <span className="text-green-600 text-sm">{status}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">角色档案</h2>
        {characters.map(c => (
          <div key={c.id} className="border rounded p-3 space-y-2">
            <div className="font-medium">{c.name}</div>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm h-20"
              value={charProfiles[c.id] ?? c.profile}
              onChange={e => setCharProfiles(prev => ({ ...prev, [c.id]: e.target.value }))}
              onBlur={e => handleUpdateChar(c.id, e.target.value)}
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
            onClick={handleAddCharacter}
          >
            添加
          </button>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => navigate(`/outline/${novelId}`)}
        >
          下一步：章节大纲 →
        </button>
      </div>
    </div>
  )
}
