// frontend/src/components/Layout.tsx
import { useNavigate } from 'react-router-dom'

interface Breadcrumb {
  label: string
  href?: string
}

interface LayoutProps {
  breadcrumbs?: Breadcrumb[]
  children: React.ReactNode
}

export default function Layout({ breadcrumbs = [], children }: LayoutProps) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-2 text-sm">
        <button
          className="font-bold text-blue-600 hover:underline"
          onClick={() => navigate('/')}
        >
          AI 小说工坊
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {crumb.href ? (
              <button
                className="text-blue-600 hover:underline"
                onClick={() => navigate(crumb.href!)}
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-gray-600">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <main className="max-w-5xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
