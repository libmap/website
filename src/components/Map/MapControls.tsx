import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'
import { BASE_TILES, type BaseTileConfig } from '@/lib/layers'
import { HomeButtonControl, GlobeButtonControl, MiniMapControl, GeocoderControl } from './controls'
import { DrawControls } from './DrawControls'

import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'

export function MapControls() {
  const map = useStore((state) => state.map.instance)
  const setMapView = useStore((state) => state.setMapView)
  const selectTweet = useStore((state) => state.selectTweet)
  const setFilter = useStore((state) => state.setFilter)
  const setPage = useStore((state) => state.setPage)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const setVisibleTweetIds = useStore((state) => state.setVisibleTweetIds)
  const tweetsData = useStore((state) => state.tweets.data)
  const visibleLayers = useStore((state) => state.layers.visible)
  const setVisibleLayers = useStore((state) => state.setVisibleLayers)

  const controlsRef = useRef<{
    navigation?: maplibregl.NavigationControl
    scale?: maplibregl.ScaleControl
    geocoder?: GeocoderControl
    geolocate?: maplibregl.GeolocateControl
    minimap?: MiniMapControl
    draw?: any
    drawColorPicker?: any
    homeButton?: HomeButtonControl
    globeButton?: GlobeButtonControl
  }>({})

  useEffect(() => {
    if (!map) return

    // Navigation control (zoom buttons + compass with pitch visualization)
    const navigationControl = new maplibregl.NavigationControl({
      visualizePitch: true,
      showZoom: true,
      showCompass: true,
    })
    map.addControl(navigationControl, 'top-right')
    controlsRef.current.navigation = navigationControl

    // Scale control
    const scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric',
    })
    map.addControl(scaleControl, 'bottom-left')
    controlsRef.current.scale = scaleControl

    // Geocoder control (custom)
    const geocoder = new GeocoderControl()
    map.addControl(geocoder, 'top-right')
    controlsRef.current.geocoder = geocoder

    // Geolocate control
    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: false,
      showUserLocation: true,
    })
    map.addControl(geolocateControl, 'top-right')
    controlsRef.current.geolocate = geolocateControl

    // MiniMap control
    const minimap = new MiniMapControl()
    map.addControl(minimap, 'bottom-right')
    controlsRef.current.minimap = minimap

    // Home button
    const homeButton = new HomeButtonControl(() => {
      // Close tweet sidebar
      selectTweet(null)

      // Clear search filters
      setFilter('account', null)
      setFilter('hashtag', null)

      // Reset to page 1
      setPage(1)

      // Set visible layers to satellite and tweets only
      setVisibleLayers(['satellite', 'tweets'])

      // Immediately remove overlay layers from map for instant visual feedback
      const currentLayers = map.getStyle().layers || []
      const baseLayerIds = BASE_TILES.map((t: BaseTileConfig) => t.id)
      currentLayers.forEach((layer) => {
        const layerId = layer.id
        // Skip base layers, tweets, and MapLibre internal layers
        if (
          !baseLayerIds.includes(layerId) &&
          layerId !== 'tweets' &&
          !layerId.startsWith('gl-draw') &&
          !layerId.startsWith('base-')
        ) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId)
          }
          if (map.getSource(layerId)) {
            map.removeSource(layerId)
          }
        }
      })

      // Reset to default state
      const defaultCenter = { lat: 22, lng: 0 }
      const defaultZoom = 3
      map.flyTo({
        center: [defaultCenter.lng, defaultCenter.lat],
        zoom: defaultZoom,
        duration: 2000,
      })
      setMapView(defaultCenter, defaultZoom)

      // Reset state before
      setStateBefore(null)

      // Show all tweets
      const allTweetIds = Array.from(tweetsData.keys())
      setVisibleTweetIds(allTweetIds)
    })
    map.addControl(homeButton, 'bottom-right')
    controlsRef.current.homeButton = homeButton

    // Globe button
    const globeButton = new GlobeButtonControl()
    map.addControl(globeButton, 'top-right')
    controlsRef.current.globeButton = globeButton

    // Cleanup
    return () => {
      if (controlsRef.current.navigation) map.removeControl(controlsRef.current.navigation)
      if (controlsRef.current.scale) map.removeControl(controlsRef.current.scale)
      if (controlsRef.current.geocoder) map.removeControl(controlsRef.current.geocoder)
      if (controlsRef.current.geolocate) map.removeControl(controlsRef.current.geolocate)
      if (controlsRef.current.minimap) map.removeControl(controlsRef.current.minimap)
      if (controlsRef.current.homeButton) map.removeControl(controlsRef.current.homeButton)
      if (controlsRef.current.globeButton) map.removeControl(controlsRef.current.globeButton)
      controlsRef.current = {}
    }
  }, [
    map,
    setMapView,
    selectTweet,
    setFilter,
    setPage,
    setStateBefore,
    setVisibleTweetIds,
    tweetsData,
    visibleLayers,
    setVisibleLayers,
  ])

  return <DrawControls map={map} controlsRef={controlsRef} />
}
