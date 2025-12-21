import { useEffect, useRef, useState } from 'react'
import { useMap } from '@/hooks/useMap'
import { useUrlState } from '@/hooks/useUrlState'
import { useStore } from '@/store'
import { useBottomSheetSnap, getSnapHeights, isHeightSnapped } from '@/hooks/useBottomSheetSnap'
import { MapControls } from './MapControls'
import { PreviewControls } from './PreviewControls'
import { LayerManager } from './LayerManager'
import { TweetMarkers } from './TweetMarkers'
import { SearchInViewButton } from './SearchInViewButton'
import { OverviewBox } from './OverviewBox'
import { StoryViewer } from '../Sidebar/MessagesPanel/StoryViewer'

import 'maplibre-gl/dist/maplibre-gl.css'

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { initMap, destroyMap } = useMap()
  const { syncToUrl } = useUrlState()
  const mapInstance = useStore((state) => state.map.instance)
  const isMobile = useStore((state) => state.ui.isMobile)
  const isPreview = useStore((state) => state.ui.isPreview)
  const bottomSheetHeight = useStore((state) => state.ui.bottomSheetHeight)
  const viewMode = useStore((state) => state.tweets.viewMode)
  const { isSnapped } = useBottomSheetSnap()
  const [lastSnappedHeight, setLastSnappedHeight] = useState(50)

  // Show floating panel on desktop (overview box or story viewer)
  const showOverviewBox = !isMobile && viewMode === 'overview'
  const showStoryViewer = !isMobile && viewMode === 'story'

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
    const unsubscribe = useStore.subscribe(
      (state) => ({ ui: state.ui, viewMode: state.tweets.viewMode }),
      ({ ui, viewMode }, prev) => {
        const mapInstance = useStore.getState().map.instance
        if (!mapInstance) return

        // Handle mobile -> desktop transition: remove padding
        if (!ui.isMobile && prev.ui.isMobile) {
          mapInstance.setPadding({ top: 0, bottom: 0, left: 0, right: 0 })
          return
        }

        // Only adjust padding on mobile
        if (!ui.isMobile) return

        // Get snap heights based on current view mode
        const currentSnapHeights = getSnapHeights(viewMode, ui.storyContentHeight)
        const isSnapped = isHeightSnapped(ui.bottomSheetHeight, currentSnapHeights)

        // Handle height change or desktop -> mobile transition
        if (
          isSnapped &&
          (ui.bottomSheetHeight !== prev.ui.bottomSheetHeight ||
            (!prev.ui.isMobile && ui.isMobile))
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
          a.ui.bottomSheetHeight === b.ui.bottomSheetHeight &&
          a.ui.isMobile === b.ui.isMobile &&
          a.ui.storyContentHeight === b.ui.storyContentHeight &&
          a.viewMode === b.viewMode,
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

    // Only apply if at a snapped height (should be 50 on initial load)
    if (isSnapped) {
      const bottomPaddingPx = (bottomSheetHeight / 100) * window.innerHeight
      mapInstance.setPadding({ top: 0, bottom: bottomPaddingPx, left: 0, right: 0 })
    }
  }, [mapInstance, isMobile, isSnapped, bottomSheetHeight])

  // Track last snapped height to avoid crosshair moving during drag
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
          {showOverviewBox && <OverviewBox />}
          {showStoryViewer && (
            <div className="overview-box story-mode">
              <StoryViewer />
            </div>
          )}
        </>
      )}
    </div>
  )
}
