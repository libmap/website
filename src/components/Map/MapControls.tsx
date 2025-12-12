import { useEffect, useRef } from 'react'
import maplibregl, { IControl } from 'maplibre-gl'
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import {
  TerraDrawPolygonMode,
  TerraDrawLineStringMode,
  TerraDrawFreehandMode,
} from 'terra-draw'
import { useStore } from '@/store'
import { BASE_TILES, type BaseTileConfig } from '@/lib/layers'
import {
  HomeButtonControl,
  GlobeButtonControl,
  MiniMapControl,
  GeocoderControl,
  DrawColorPicker,
} from './controls'

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
    draw?: MaplibreTerradrawControl
    drawColorPicker?: DrawColorPicker
    homeButton?: HomeButtonControl
    globeButton?: GlobeButtonControl
  }>({})
  const drawColorRef = useRef<string>('#E74C3C')

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

    // Function to create draw control with current color
    const createDrawControl = (color: string) => {
      return new MaplibreTerradrawControl({
        modes: ['linestring', 'polygon', 'freehand', 'select', 'delete', 'download'],
        open: true,
        modeOptions: {
          polygon: new TerraDrawPolygonMode({
            styles: {
              fillColor: color,
              fillOpacity: 0.4,
              outlineColor: color,
              outlineWidth: 2,
              closingPointColor: color,
              closingPointOutlineColor: '#ffffff',
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            },
          }),
          linestring: new TerraDrawLineStringMode({
            styles: {
              lineStringColor: color,
              lineStringWidth: 3,
              closingPointColor: color,
              closingPointOutlineColor: '#ffffff',
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            },
          }),
          freehand: new TerraDrawFreehandMode({
            styles: {
              lineStringColor: color,
              lineStringWidth: 3,
              closingPointColor: color,
              closingPointOutlineColor: '#ffffff',
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            },
          }),
        },
      })
    }

    // Initialize color picker
    const colorPicker = new DrawColorPicker((color) => {
      drawColorRef.current = color

      // Preserve existing features before removing
      const existingFeatures = controlsRef.current.draw?.getFeatures()

      // Remove and re-add draw control with new color
      if (controlsRef.current.draw) {
        map.removeControl(controlsRef.current.draw as unknown as IControl)
      }
      const newDraw = createDrawControl(color)
      map.addControl(newDraw as unknown as IControl, 'top-right')
      controlsRef.current.draw = newDraw

      // Re-inject color button into new Terra Draw toolbar
      setTimeout(() => {
        let newContainer =
          document.querySelector('.maplibregl-terradraw-list') ||
          document.querySelector('.maplibregl-ctrl-terradraw') ||
          document.querySelector('[class*="terradraw"]')

        if (!newContainer) {
          const allElements = document.querySelectorAll('[class*="terradraw"]')
          newContainer = allElements[0]
        }

        if (newContainer) {
          const colorButton = colorPicker.createColorButton(newContainer as HTMLElement)
          newContainer.appendChild(colorButton)
        }
      }, 100)

      // Restore existing features after a short delay to ensure Terra Draw is enabled
      if (existingFeatures && existingFeatures.features.length > 0) {
        setTimeout(() => {
          try {
            const terraDrawInstance = newDraw.getTerraDrawInstance()
            // Activate the draw control if not already active
            if (!terraDrawInstance.enabled) {
              newDraw.activate()
            }
            existingFeatures.features.forEach((feature) => {
              terraDrawInstance.addFeatures([feature])
            })
          } catch (error) {
            console.warn('Failed to restore features after color change:', error)
          }
        }, 100)
      }
    })
    controlsRef.current.drawColorPicker = colorPicker

    // Initialize Terra Draw control with default color
    const draw = createDrawControl(drawColorRef.current)
    map.addControl(draw as unknown as IControl, 'top-right')
    controlsRef.current.draw = draw

    // Inject color button into Terra Draw toolbar after it's rendered
    setTimeout(() => {
      // Access the control container directly from the draw control instance
      const drawControl = draw as any
      const terraDrawContainer = drawControl.controlContainer

      if (terraDrawContainer) {
        console.log('Found Terra Draw container:', terraDrawContainer.className)
        const colorButton = colorPicker.createColorButton(terraDrawContainer as HTMLElement)
        terraDrawContainer.appendChild(colorButton)
      } else {
        console.error('Terra Draw container not found')
      }
    }, 200)

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
      if (controlsRef.current.drawColorPicker) controlsRef.current.drawColorPicker.destroy()
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
