import { useEffect } from 'react'
import { MapContainer } from '@/components/Map/MapContainer'
import { useUrlState } from '@/hooks/useUrlState'
import { useStore } from '@/store'

export function PreviewPage() {
  const { initFromUrl } = useUrlState()
  const isInitialized = useStore((state) => state.isInitialized)
  const setIsPreview = useStore((state) => state.setIsPreview)
  const mapInstance = useStore((state) => state.map.instance)

  // Initialize from URL on mount and enable preview mode
  useEffect(() => {
    initFromUrl()
    setIsPreview(true)

    // Add preview-mode class to body
    document.body.classList.add('preview-mode')

    // Dispatch event when map is ready for screenshot
    if (mapInstance) {
      const handleIdle = () => {
        window.dispatchEvent(new Event('maplibre-loaded'))
      }

      mapInstance.on('idle', handleIdle)

      return () => {
        mapInstance.off('idle', handleIdle)
        document.body.classList.remove('preview-mode')
      }
    }

    return () => {
      document.body.classList.remove('preview-mode')
    }
  }, [initFromUrl, setIsPreview, mapInstance])

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
    </div>
  )
}
