import { useEffect, useRef, useState } from 'react'
import { useMap } from '@/hooks/useMap'
import { useUrlState } from '@/hooks/useUrlState'
import { useStore } from '@/store'
import { MapControls } from './MapControls'
import { PreviewControls } from './PreviewControls'
import { LayerManager } from './LayerManager'
import { TweetMarkers } from './TweetMarkers'
import { SearchInViewButton } from './SearchInViewButton'

import 'maplibre-gl/dist/maplibre-gl.css'

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { initMap, destroyMap } = useMap()
  const { syncToUrl } = useUrlState()
  const mapInstance = useStore((state) => state.map.instance)
  const isMobile = useStore((state) => state.ui.isMobile)
  const isPreview = useStore((state) => state.ui.isPreview)
  const bottomSheetHeight = useStore((state) => state.ui.bottomSheetHeight)
  const [lastSnappedHeight, setLastSnappedHeight] = useState(50)

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

  // Adjust map padding when BottomSheet height changes (mobile only)
  useEffect(() => {
    const snappedHeights = [10, 30, 50, 70]

    const unsubscribe = useStore.subscribe(
      (state) => state.ui,
      (ui, prevUi) => {
        const mapInstance = useStore.getState().map.instance
        if (!mapInstance) return

        // Handle mobile -> desktop transition: remove padding
        if (!ui.isMobile && prevUi.isMobile) {
          mapInstance.setPadding({ top: 0, bottom: 0, left: 0, right: 0 })
          return
        }

        // Only adjust padding on mobile
        if (!ui.isMobile) return

        // Only update if height is at a snapped value (after handleDragEnd)
        const isSnapped = snappedHeights.includes(ui.bottomSheetHeight)

        // Handle height change or desktop -> mobile transition
        if (
          isSnapped &&
          (ui.bottomSheetHeight !== prevUi.bottomSheetHeight ||
            (!prevUi.isMobile && ui.isMobile))
        ) {
          const bottomPaddingPx = (ui.bottomSheetHeight / 100) * window.innerHeight

          mapInstance.easeTo({
            padding: { top: 0, bottom: bottomPaddingPx, left: 0, right: 0 },
            duration: 300,
          })
        }
      },
      {
        equalityFn: (a, b) =>
          a.bottomSheetHeight === b.bottomSheetHeight && a.isMobile === b.isMobile,
      }
    )

    // Handle window resize
    const handleResize = () => {
      const {
        map: { instance },
        ui: { isMobile, bottomSheetHeight },
      } = useStore.getState()
      if (!instance || !isMobile) return

      const bottomPaddingPx = (bottomSheetHeight / 100) * window.innerHeight
      instance.setPadding({ top: 0, bottom: bottomPaddingPx, left: 0, right: 0 })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribe()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Apply initial padding when both map loads AND mobile is detected
  useEffect(() => {
    if (!mapInstance || !isMobile) return

    const snappedHeights = [10, 30, 50, 70]
    const isSnapped = snappedHeights.includes(bottomSheetHeight)

    // Only apply if at a snapped height (should be 50 on initial load)
    if (isSnapped) {
      const bottomPaddingPx = (bottomSheetHeight / 100) * window.innerHeight
      mapInstance.setPadding({ top: 0, bottom: bottomPaddingPx, left: 0, right: 0 })
    }
  }, [mapInstance, isMobile])

  // Track last snapped height to avoid crosshair moving during drag
  const snappedHeights = [10, 30, 50, 70]
  const isSnapped = snappedHeights.includes(bottomSheetHeight)

  useEffect(() => {
    if (isSnapped) {
      setLastSnappedHeight(bottomSheetHeight)
    }
  }, [bottomSheetHeight, isSnapped])

  // Calculate crosshair position using last snapped height (only updates after release)
  const crosshairTop = isMobile ? `calc(50% - ${lastSnappedHeight / 2}vh)` : '50%'

  return (
    <div className="map-wrapper">
      <div ref={containerRef} id="map" className="map-container">
        {!isPreview && (
          <img
            src="/crosshair.png"
            alt="Crosshair"
            className="crosshair"
            style={{ top: crosshairTop }}
          />
        )}
      </div>
      {mapInstance && (
        <>
          {isPreview ? <PreviewControls /> : <MapControls />}
          <LayerManager />
          <TweetMarkers />
          {!isPreview && <SearchInViewButton />}
        </>
      )}
    </div>
  )
}
