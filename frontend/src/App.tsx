// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NovelList from './pages/NovelList'
import NovelCreate from './pages/NovelCreate'
import NovelDetail from './pages/NovelDetail'
import ChapterList from './pages/ChapterList'
import ChapterDetail from './pages/ChapterDetail'
import NovelSettings from './pages/NovelSettings'
import OutlinePage from './pages/Outline'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/novels" element={<NovelList />} />
        <Route path="/novels/new" element={<NovelCreate />} />
        <Route path="/novels/:novelId" element={<NovelDetail />} />
        <Route path="/novels/:novelId/chapters" element={<ChapterList />} />
        <Route path="/novels/:novelId/chapters/:num" element={<ChapterDetail />} />
        <Route path="/novels/:novelId/settings" element={<NovelSettings />} />
        <Route path="/novels/:novelId/outline" element={<OutlinePage />} />
      </Routes>
    </BrowserRouter>
  )
}
