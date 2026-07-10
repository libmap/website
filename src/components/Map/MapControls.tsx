import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'
import { BASE_TILES, type BaseTileConfig } from '@/lib/layers'
import {
  HomeButtonControl,
  // MiniMapControl,
  GeocoderControl,
  ShareLinkControl,
  type DrawColorPicker,
} from './controls'
import type { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import { DrawControls } from './DrawControls'

import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'

export function MapControls() {
  const map = useStore((state) => state.map.instance)
  const setMapView = useStore((state) => state.setMapView)
  const selectTweet = useStore((state) => state.selectTweet)
  const exitStoryView = useStore((state) => state.exitStoryView)
  const setFilter = useStore((state) => state.setFilter)
  const setOverviewPage = useStore((state) => state.setOverviewPage)
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
    // minimap?: MiniMapControl
    draw?: MaplibreTerradrawControl
    drawColorPicker?: DrawColorPicker
    homeButton?: HomeButtonControl
    globe?: maplibregl.GlobeControl
    shareLink?: ShareLinkControl
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
    map.addControl(geocoder, 'top-left')
    controlsRef.current.geocoder = geocoder

    // Geolocate control
    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: false,
      showUserLocation: true,
    })
    map.addControl(geolocateControl, 'top-left')
    controlsRef.current.geolocate = geolocateControl

    // MiniMap control - temporarily disabled
    // const minimap = new MiniMapControl()
    // map.addControl(minimap, 'bottom-right')
    // controlsRef.current.minimap = minimap

    // Home button
    const homeButton = new HomeButtonControl(() => {
      // Close tweet sidebar and exit story view
      selectTweet(null)
      exitStoryView()

      // Clear search filters
      setFilter('account', null)
      setFilter('hashtag', null)

      // Reset to page 1
      setOverviewPage(1)

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

    // Share link button
    const shareLink = new ShareLinkControl()
    map.addControl(shareLink, 'bottom-right')
    controlsRef.current.shareLink = shareLink

    // Globe control
    const globeControl = new maplibregl.GlobeControl()
    map.addControl(globeControl, 'top-right')
    controlsRef.current.globe = globeControl

    // Cleanup: only remove the controls this effect added — draw and
    // drawColorPicker belong to DrawControls and must survive re-runs
    const controls = controlsRef.current
    return () => {
      if (controls.navigation) map.removeControl(controls.navigation)
      if (controls.scale) map.removeControl(controls.scale)
      if (controls.geocoder) map.removeControl(controls.geocoder)
      if (controls.geolocate) map.removeControl(controls.geolocate)
      // if (controls.minimap) map.removeControl(controls.minimap)
      if (controls.homeButton) map.removeControl(controls.homeButton)
      if (controls.shareLink) map.removeControl(controls.shareLink)
      if (controls.globe) map.removeControl(controls.globe)
      delete controls.navigation
      delete controls.scale
      delete controls.geocoder
      delete controls.geolocate
      delete controls.homeButton
      delete controls.shareLink
      delete controls.globe
    }
  }, [
    map,
    setMapView,
    selectTweet,
    exitStoryView,
    setFilter,
    setOverviewPage,
    setStateBefore,
    setVisibleTweetIds,
    tweetsData,
    visibleLayers,
    setVisibleLayers,
  ])

  return <DrawControls map={map} controlsRef={controlsRef} />
}
