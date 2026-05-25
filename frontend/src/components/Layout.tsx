// frontend/src/components/Layout.tsx
import { useNavigate } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
  novelTitle?: string
  novelId?: string
  activeTab?: 'chapters' | 'outline' | 'settings'
  // backward-compat: old pages pass breadcrumbs until deleted in Task 11
  breadcrumbs?: unknown
}

const TABS = [
  { key: 'chapters' as const, label: '章节列表', href: (id: string) => `/novels/${id}/chapters` },
  { key: 'outline' as const, label: '章节大纲', href: (id: string) => `/novels/${id}/outline` },
  { key: 'settings' as const, label: '设定与角色', href: (id: string) => `/novels/${id}/settings` },
]

export default function Layout({ children, novelTitle, novelId, activeTab }: LayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-base text-slate-100">
      {/* Topbar */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-surface/95 backdrop-blur-sm border-b border-rim shadow-sm flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity shrink-0"
        >
          AI 小说工坊
        </button>
        {novelTitle && (
          <span className="text-sm text-slate-400 truncate">{novelTitle}</span>
        )}
      </header>

      {/* Tab navigation — only when inside a novel */}
      {novelId && (
        <nav className="fixed top-14 inset-x-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-rim">
          <div className="max-w-5xl mx-auto px-6 flex">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => navigate(tab.href(novelId))}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main */}
      <main className={`max-w-5xl mx-auto px-6 pb-16 ${novelId ? 'pt-[7rem]' : 'pt-20'}`}>
        {children}
      </main>
    </div>
  )
}
