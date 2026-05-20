import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import OutlinePage from './pages/Outline'
import Writer from './pages/Writer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/setup/:novelId" element={<Setup />} />
        <Route path="/outline/:novelId" element={<OutlinePage />} />
        <Route path="/write/:novelId" element={<Writer />} />
      </Routes>
    </BrowserRouter>
  )
}
