import { useEffect, useRef } from 'react'
import { useMap } from '@/hooks/useMap'
import { useUrlState } from '@/hooks/useUrlState'
import { useStore } from '@/store'
import { MapControls } from './MapControls'
import { LayerManager } from './LayerManager'
import { TweetMarkers } from './TweetMarkers'
import { SearchInViewButton } from './SearchInViewButton'

import 'maplibre-gl/dist/maplibre-gl.css'

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { initMap, destroyMap } = useMap()
  const { syncToUrl } = useUrlState()
  const mapInstance = useStore((state) => state.map.instance)

  // Initialize map once on mount
  useEffect(() => {
    if (!containerRef.current) return

    initMap(containerRef.current)

    // Cleanup only on unmount
    return () => {
      // Only destroy if we're actually unmounting (not just re-rendering)
      // Check if the container is being removed from DOM
      if (!document.body.contains(containerRef.current)) {
        destroyMap()
      }
    }
  }, []) // Empty deps - only run once

  // Sync URL on map move/zoom
  useEffect(() => {
    if (!mapInstance) return

    const handleMoveEnd = () => {
      syncToUrl()
    }

    mapInstance.on('moveend', handleMoveEnd)
    return () => {
      mapInstance.off('moveend', handleMoveEnd)
    }
  }, [mapInstance, syncToUrl])

  // Sync URL when layers change
  const visibleLayers = useStore((state) => state.layers.visible)
  useEffect(() => {
    if (!mapInstance) return
    syncToUrl()
  }, [mapInstance, visibleLayers, syncToUrl])

  return (
    <div className="map-wrapper">
      <div ref={containerRef} id="map" className="map-container">
        <img src="/crosshair.png" alt="Crosshair" className="crosshair" />
      </div>
      {mapInstance && (
        <>
          <MapControls />
          <LayerManager />
          <TweetMarkers />
          <SearchInViewButton />
        </>
      )}
    </div>
  )
}
