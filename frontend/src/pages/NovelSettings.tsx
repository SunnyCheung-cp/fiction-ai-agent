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
  const [provider, setProvider] = useState<'anthropic' | 'deepseek'>('anthropic')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!novelId) return
    api.novels.get(novelId).then(n => {
      setNovel(n)
      setWorldBible(n.world_bible)
      setAutoGenerate(n.auto_generate)
      setDailyTime(n.daily_time ?? '08:00')
      setProvider((n.provider as 'anthropic' | 'deepseek') ?? 'anthropic')
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
      await api.novels.update(novelId, { world_bible: worldBible, auto_generate: autoGenerate, daily_time: dailyTime, provider })
      setStatus('已保存')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('保存失败')
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
      setStatus('添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateChar(charId: string, profile: string) {
    if (!novelId) return
    await api.characters.update(novelId, charId, profile).catch(console.error)
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, profile } : c))
  }

  async function handleDeleteChar(charId: string, name: string) {
    if (!novelId) return
    if (!window.confirm(`确定删除角色「${name}」？`)) return
    await api.characters.delete(novelId, charId).catch(console.error)
    setCharacters(prev => prev.filter(c => c.id !== charId))
    setCharProfiles(prev => { const n = { ...prev }; delete n[charId]; return n })
  }

  const inputCls = "w-full bg-base border border-rim rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const title = novel?.title ?? '…'

  return (
    <Layout novelTitle={title} novelId={novelId} activeTab="settings">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-xl font-bold text-slate-100">设定与角色</h1>

        {/* World Bible */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">世界观 / 故事圣经</h2>
          <textarea
            className={`${inputCls} h-40 resize-none`}
            value={worldBible}
            onChange={e => setWorldBible(e.target.value)}
          />
        </section>

        {/* Auto generation */}
        <section className="bg-surface border border-rim rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">自动生成</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoGen"
              checked={autoGenerate}
              onChange={e => setAutoGenerate(e.target.checked)}
              className="w-4 h-4 accent-indigo-500"
            />
            <label htmlFor="autoGen" className="text-sm text-slate-300">开启每日自动生章</label>
          </div>
          {autoGenerate && (
            <div className="flex items-center gap-3 pl-7">
              <label className="text-xs text-slate-500">每天生成时间</label>
              <input
                type="time"
                value={dailyTime}
                onChange={e => setDailyTime(e.target.value)}
                className="bg-base border border-rim rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}
        </section>

        {/* AI Model */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">AI 模型</h2>
          <div className="flex gap-4">
            {(['anthropic', 'deepseek'] as const).map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  checked={provider === p}
                  onChange={() => setProvider(p)}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">{p === 'anthropic' ? 'Claude (Anthropic)' : 'DeepSeek'}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            {provider === 'anthropic' ? '需要 ANTHROPIC_API_KEY，写作质量更高' : '需要 DEEPSEEK_API_KEY，费用约低 10 倍'}
          </p>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
            disabled={saving}
            onClick={handleSaveAll}
          >
            保存设定
          </button>
          {status && (
            <span className={`text-sm ${status.includes('失败') ? 'text-red-400' : 'text-emerald-400'}`}>{status}</span>
          )}
        </div>

        {/* Characters */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">角色档案</h2>
          {characters.map(c => (
            <div key={c.id} className="bg-surface border border-rim rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{c.name}</span>
                <button
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                  onClick={() => handleDeleteChar(c.id, c.name).catch(console.error)}
                >
                  删除
                </button>
              </div>
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={charProfiles[c.id] ?? c.profile}
                onChange={e => setCharProfiles(prev => ({ ...prev, [c.id]: e.target.value }))}
                onBlur={e => handleUpdateChar(c.id, e.target.value).catch(console.error)}
              />
            </div>
          ))}

          {/* Add new character */}
          <div className="bg-surface border border-rim rounded-xl p-4 space-y-3">
            <p className="text-sm text-slate-500">添加新角色</p>
            <input
              className={inputCls}
              placeholder="角色名"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
            />
            <textarea
              className={`${inputCls} h-20 resize-none`}
              placeholder="角色档案描述"
              value={newCharProfile}
              onChange={e => setNewCharProfile(e.target.value)}
            />
            <button
              className="bg-surface-hover border border-rim text-slate-300 px-3 py-1.5 rounded-lg text-sm hover:border-indigo-500/50 disabled:opacity-40 transition-colors"
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
