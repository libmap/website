import { useEffect, useRef } from 'react'
import maplibregl, { IControl } from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useStore } from '@/store'
import { BASE_TILES, type BaseTileConfig } from '@/lib/layers'
import {
  HomeButtonControl,
  GlobeButtonControl,
  MiniMapControl,
  GeocoderControl,
} from './controls'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

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
    draw?: MapboxDraw
    homeButton?: HomeButtonControl
    globeButton?: GlobeButtonControl
  }>({})

  useEffect(() => {
    if (!map) return

    // Navigation control (zoom buttons, no compass)
    const navigationControl = new maplibregl.NavigationControl({
      showCompass: false,
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

    // Draw control
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        line_string: true,
        trash: true,
      },
      styles: [
        // Polygon fill
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3b82f6',
            'fill-outline-color': '#3b82f6',
            'fill-opacity': 0.3,
          },
        },
        // Polygon stroke
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
          },
        },
        // Line
        {
          id: 'gl-draw-line',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
          },
        },
        // Point (vertex)
        {
          id: 'gl-draw-point',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#fff',
            'circle-stroke-color': '#3b82f6',
            'circle-stroke-width': 2,
          },
        },
      ],
    })
    map.addControl(draw as unknown as IControl, 'top-right')
    controlsRef.current.draw = draw

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
      if (controlsRef.current.draw)
        map.removeControl(controlsRef.current.draw as unknown as IControl)
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

  return null
}
