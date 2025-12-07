import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useStore } from '@/store'
import 'leaflet-easybutton'

// Import Leaflet plugins
import 'leaflet-control-geocoder'
import 'leaflet.locatecontrol'
import 'leaflet-minimap'
import 'leaflet-draw'

// Import plugin CSS
import 'leaflet-control-geocoder/dist/Control.Geocoder.css'
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css'
import 'leaflet-minimap/dist/Control.MiniMap.min.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-easybutton/src/easy-button.css'

// Extend Leaflet types for plugins
declare module 'leaflet' {
  namespace Control {
    class Geocoder extends L.Control {
      constructor(options?: GeocoderOptions)
    }
    interface GeocoderOptions {
      defaultMarkGeocode?: boolean
      placeholder?: string
      errorMessage?: string
      showResultIcons?: boolean
      collapsed?: boolean
      expand?: string
      position?: L.ControlPosition
    }

    class Locate extends L.Control {
      constructor(options?: LocateOptions)
      start(): void
      stop(): void
    }
    interface LocateOptions {
      position?: L.ControlPosition
      strings?: {
        title?: string
      }
      flyTo?: boolean
      showPopup?: boolean
      locateOptions?: L.LocateOptions
    }

    class Draw extends L.Control {
      constructor(options?: DrawOptions)
    }
    interface DrawOptions {
      position?: L.ControlPosition
      draw?: object
      edit?: object
    }
  }

  namespace Draw {
    namespace Event {
      const CREATED: string
      const EDITED: string
      const DELETED: string
    }
  }

  class MiniMap extends L.Control {
    constructor(layer: L.TileLayer, options?: MiniMapOptions)
  }
  interface MiniMapOptions {
    toggleDisplay?: boolean
    minimized?: boolean
    position?: L.ControlPosition
    width?: number
    height?: number
    zoomLevelOffset?: number
    zoomLevelFixed?: number
  }
}

// EasyButton types
declare module 'leaflet' {
  namespace Control {
    class EasyButton extends L.Control {
      constructor(options: EasyButtonOptions | string, callback?: () => void)
    }
  }

  interface EasyButtonOptions {
    id?: string
    position?: L.ControlPosition
    states?: EasyButtonState[]
    leafletClasses?: boolean
    tagName?: string
  }

  interface EasyButtonState {
    stateName: string
    icon: string
    title: string
    onClick: (btn: any, map: L.Map) => void
  }

  function easyButton(options: EasyButtonOptions): Control.EasyButton
}

export function MapControls() {
  const map = useStore((state) => state.map.instance)
  const setMapView = useStore((state) => state.setMapView)
  const selectTweet = useStore((state) => state.selectTweet)
  const setFilter = useStore((state) => state.setFilter)
  const setPage = useStore((state) => state.setPage)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const setVisibleTweetIds = useStore((state) => state.setVisibleTweetIds)
  const tweetsData = useStore((state) => state.tweets.data)

  const controlsRef = useRef<{
    zoom?: L.Control.Zoom
    scale?: L.Control.Scale
    geocoder?: L.Control.Geocoder
    locate?: L.Control.Locate
    minimap?: L.MiniMap
    draw?: L.Control.Draw
    homeButton?: L.Control.EasyButton
  }>({})

  const editableLayersRef = useRef<L.FeatureGroup | null>(null)

  useEffect(() => {
    if (!map) return

    // Zoom control (top-right)
    const zoomControl = L.control.zoom({
      position: 'topright',
    })
    zoomControl.addTo(map)
    controlsRef.current.zoom = zoomControl

    // Scale control (bottom-left)
    const scaleControl = L.control.scale({
      position: 'bottomleft',
      imperial: false,
    })
    scaleControl.addTo(map)
    controlsRef.current.scale = scaleControl

    // Geocoder control (search)
    try {
      const geocoder = new (L.Control as any).Geocoder({
        defaultMarkGeocode: false,
        placeholder: 'Search location...',
        errorMessage: 'Nothing found.',
        showResultIcons: true,
        collapsed: true,
        expand: 'click',
        position: 'topright',
      })

      geocoder.on('markgeocode', (e: any) => {
        const { center, bbox } = e.geocode
        if (bbox) {
          map.fitBounds(bbox)
        } else if (center) {
          map.setView(center, 12)
        }
        setMapView({ lat: center.lat, lng: center.lng }, map.getZoom())
      })

      geocoder.addTo(map)
      controlsRef.current.geocoder = geocoder
    } catch (e) {
      console.warn('Geocoder control not available:', e)
    }

    // Locate control (GPS)
    try {
      const locateControl = new (L.Control as any).Locate({
        position: 'topright',
        strings: {
          title: 'Show my location',
        },
        flyTo: true,
        showPopup: false,
        locateOptions: {
          maxZoom: 16,
        },
      })
      locateControl.addTo(map)
      controlsRef.current.locate = locateControl
    } catch (e) {
      console.warn('Locate control not available:', e)
    }

    // MiniMap control
    try {
      const minimapLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
        {
          attribution: '© CARTO',
          maxZoom: 20,
          subdomains: 'abc',
        }
      )

      const minimap = new (L as any).Control.MiniMap(minimapLayer, {
        toggleDisplay: true,
        minimized: false,
        position: 'bottomright',
        width: 150,
        height: 150,
        zoomLevelOffset: -5,
      })
      minimap.addTo(map)
      controlsRef.current.minimap = minimap
    } catch (e) {
      console.warn('MiniMap control not available:', e)
    }

    // Draw control
    try {
      // Create feature group for editable layers
      const editableLayers = new L.FeatureGroup()
      map.addLayer(editableLayers)
      editableLayersRef.current = editableLayers

      const drawControl = new (L.Control as any).Draw({
        position: 'topright',
        draw: {
          polyline: {
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
            },
          },
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.3,
            },
          },
          circle: false,
          circlemarker: false,
          marker: false,
          rectangle: {
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.3,
            },
          },
        },
        edit: {
          featureGroup: editableLayers,
          remove: true,
        },
      })
      drawControl.addTo(map)
      controlsRef.current.draw = drawControl

      // Handle draw events
      map.on('draw:created', (e: any) => {
        const layer = e.layer
        editableLayers.addLayer(layer)
      })
    } catch (e) {
      console.warn('Draw control not available:', e)
    }

    // Home button
    try {
      const homeButton = (L as any).easyButton({
        states: [
          {
            stateName: 'go-home',
            icon: 'nf nf-fa-home',
            title: 'Overview',
            onClick: () => {
              // Close tweet sidebar
              selectTweet(null)

              // Clear search filters
              setFilter('account', null)
              setFilter('hashtag', null)

              // Reset to page 1
              setPage(1)

              // Reset to default state (matching old JS defaultState)
              const defaultCenter = { lat: 22, lng: 0 }
              const defaultZoom = 3
              map.flyTo(defaultCenter, defaultZoom, { duration: 2 })
              setMapView(defaultCenter, defaultZoom)

              // Reset state before
              setStateBefore(null)

              // Show all tweets
              const allTweetIds = Array.from(tweetsData.keys())
              setVisibleTweetIds(allTweetIds)
            },
          },
        ],
      })

      homeButton.setPosition('bottomright')
      homeButton.addTo(map)
      controlsRef.current.homeButton = homeButton
    } catch (e) {
      console.warn('Home button not available:', e)
    }

    // Cleanup
    return () => {
      if (controlsRef.current.zoom) {
        controlsRef.current.zoom.remove()
      }
      if (controlsRef.current.scale) {
        controlsRef.current.scale.remove()
      }
      if (controlsRef.current.geocoder) {
        controlsRef.current.geocoder.remove()
      }
      if (controlsRef.current.locate) {
        controlsRef.current.locate.remove()
      }
      if (controlsRef.current.minimap) {
        controlsRef.current.minimap.remove()
      }
      if (controlsRef.current.draw) {
        controlsRef.current.draw.remove()
      }
      if (controlsRef.current.homeButton) {
        controlsRef.current.homeButton.remove()
      }
      if (editableLayersRef.current) {
        map.removeLayer(editableLayersRef.current)
      }
      controlsRef.current = {}
    }
  }, [map, setMapView, selectTweet, setFilter, setPage, setStateBefore, setVisibleTweetIds, tweetsData])

  return null
}
