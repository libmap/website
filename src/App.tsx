import { Routes, Route, Navigate } from 'react-router-dom'
import { MapPage } from '@/pages/MapPage'
import { PreviewPage } from '@/pages/PreviewPage'

function App() {
  return (
    <Routes>
      {/* Redirect root to /map */}
      <Route path="/" element={<Navigate to="/map" replace />} />

      {/* Main map routes */}
      <Route path="/map" element={<MapPage />} />
      <Route path="/@:account/map" element={<MapPage />} />
      <Route path="/~:hashtag/map" element={<MapPage />} />
      <Route path="/@:account/~:hashtag/map" element={<MapPage />} />

      {/* Preview route for OG image generation */}
      <Route path="/preview" element={<PreviewPage />} />
    </Routes>
  )
}

export default App
