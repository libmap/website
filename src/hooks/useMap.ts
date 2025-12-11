import { useCallback, useRef } from 'react'
import maplibregl, { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import { useStore } from '@/store'
import { getStyleForBaseLayer } from '@/lib/layers/maplibreStyles'
import { BASE_TILES } from '@/lib/layers'
import type { Coordinates } from '@/types'

// Store the map instance outside of React to prevent re-renders from destroying it
let globalMapInstance: MapLibreMap | null = null

export function useMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isInitializedRef = useRef(false)

  const setMapInstance = useStore((state) => state.setMapInstance)
  const setMapView = useStore((state) => state.setMapView)
  const setMapBounds = useStore((state) => state.setMapBounds)

  const initMap = useCallback(
    (container: HTMLDivElement) => {
      // Prevent double initialization
      if (isInitializedRef.current && globalMapInstance) {
        return globalMapInstance
      }

      // Get initial state directly from store (not reactive)
      const state = useStore.getState()
      const { center, zoom } = state.map
      // Derive base layer from visibleLayers (same logic as LayerManager)
      const baseLayer = state.layers.visible.find((id) => BASE_TILES.some((t) => t.id === id)) ?? 'satellite'

      const map = new MapLibreMap({
        container,
        style: getStyleForBaseLayer(baseLayer),
        center: [center.lng, center.lat], // MapLibre uses [lng, lat]
        zoom,
        maxZoom: 19,
        minZoom: 2,
      })

      globalMapInstance = map
      isInitializedRef.current = true
      containerRef.current = container

      map.on('load', () => {
        setMapInstance(map)
        setMapBounds(map.getBounds())
      })

      // Sync map movements to store (debounced to prevent rapid updates)
      let moveTimeout: ReturnType<typeof setTimeout> | null = null
      map.on('moveend', () => {
        if (moveTimeout) clearTimeout(moveTimeout)
        moveTimeout = setTimeout(() => {
          const mapCenter = map.getCenter()
          const mapZoom = map.getZoom()
          setMapView({ lat: mapCenter.lat, lng: mapCenter.lng }, mapZoom)
          setMapBounds(map.getBounds())
        }, 100)
      })

      return map
    },
    [setMapInstance, setMapView, setMapBounds]
  )

  const destroyMap = useCallback(() => {
    if (globalMapInstance) {
      try {
        globalMapInstance.remove()
      } catch (e) {
        // Ignore errors during cleanup
      }
      globalMapInstance = null
      isInitializedRef.current = false
      setMapInstance(null)
    }
  }, [setMapInstance])

  const flyTo = useCallback((center: Coordinates, zoom?: number, animate = true) => {
    if (!globalMapInstance) return

    const targetZoom = zoom ?? globalMapInstance.getZoom()

    if (animate) {
      globalMapInstance.flyTo({
        center: [center.lng, center.lat],
        zoom: targetZoom,
        duration: 1500,
      })
    } else {
      globalMapInstance.jumpTo({
        center: [center.lng, center.lat],
        zoom: targetZoom,
      })
    }
  }, [])

  const fitBounds = useCallback((bounds: LngLatBoundsLike, padding = 50) => {
    if (!globalMapInstance) return
    globalMapInstance.fitBounds(bounds, { padding })
  }, [])

  return {
    map: globalMapInstance,
    initMap,
    destroyMap,
    flyTo,
    fitBounds,
  }
}

export function useMapEvents(
  events: Partial<{
    click: (e: maplibregl.MapMouseEvent) => void
    moveend: () => void
    zoomend: () => void
  }>
) {
  const mapInstance = useStore((state) => state.map.instance)

  // Use a ref to track if we've attached handlers
  const handlersAttachedRef = useRef(false)

  if (mapInstance && !handlersAttachedRef.current) {
    if (events.click) {
      mapInstance.on('click', events.click)
    }
    if (events.moveend) {
      mapInstance.on('moveend', events.moveend)
    }
    if (events.zoomend) {
      mapInstance.on('zoomend', events.zoomend)
    }
    handlersAttachedRef.current = true
  }
}
