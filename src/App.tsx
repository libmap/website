import { useEffect } from 'react'
import { MapContainer } from '@/components/Map/MapContainer'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { useUrlState } from '@/hooks/useUrlState'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useStore } from '@/store'

function App() {
  const { initFromUrl } = useUrlState()
  const isInitialized = useStore((state) => state.isInitialized)
  const setIsMobile = useStore((state) => state.setIsMobile)
  const isMobile = useIsMobile()

  // Initialize from URL on mount
  useEffect(() => {
    initFromUrl()
  }, [initFromUrl])

  // Sync mobile state
  useEffect(() => {
    setIsMobile(isMobile)
  }, [isMobile, setIsMobile])

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading map...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <MapContainer />
      <Sidebar />
    </div>
  )
}

export default App
