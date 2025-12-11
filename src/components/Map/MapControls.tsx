import { useEffect, useRef } from 'react'
import maplibregl, { IControl } from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useStore } from '@/store'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

// Custom Home Button Control
class HomeButtonControl implements IControl {
  private _container: HTMLDivElement | undefined
  private _onClick: () => void

  constructor(onClick: () => void) {
    this._onClick = onClick
  }

  onAdd(): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.className = 'maplibregl-ctrl-home'
    button.type = 'button'
    button.title = 'Overview'
    button.setAttribute('aria-label', 'Overview')
    button.innerHTML = '<span class="nf nf-fa-home"></span>'
    button.addEventListener('click', this._onClick)

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}

// Custom MiniMap Control
class MiniMapControl implements IControl {
  private _map: maplibregl.Map | undefined
  private _miniMap: maplibregl.Map | undefined
  private _container: HTMLDivElement | undefined
  private _isMinimized = false

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-minimap'

    // Mini map container
    const miniMapContainer = document.createElement('div')
    miniMapContainer.className = 'minimap-container'
    this._container.appendChild(miniMapContainer)

    // Toggle button
    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'minimap-toggle'
    toggleBtn.innerHTML = '−'
    toggleBtn.title = 'Toggle minimap'
    toggleBtn.addEventListener('click', () => this.toggleMinimize(toggleBtn))
    this._container.appendChild(toggleBtn)

    // Initialize mini map after container is in DOM
    setTimeout(() => {
      this._miniMap = new maplibregl.Map({
        container: miniMapContainer,
        style: {
          version: 8,
          sources: {
            'carto-light': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© CARTO',
            },
          },
          layers: [{ id: 'carto-light', type: 'raster', source: 'carto-light' }],
        },
        center: map.getCenter(),
        zoom: Math.max(0, map.getZoom() - 5),
        interactive: false,
        attributionControl: false,
      })

      // Sync mini map with main map
      map.on('move', () => this.syncMiniMap())
    }, 0)

    return this._container
  }

  syncMiniMap(): void {
    if (!this._miniMap || !this._map) return
    this._miniMap.setCenter(this._map.getCenter())
    this._miniMap.setZoom(Math.max(0, this._map.getZoom() - 5))
  }

  toggleMinimize(button: HTMLButtonElement): void {
    this._isMinimized = !this._isMinimized
    if (this._container) {
      this._container.classList.toggle('minimized', this._isMinimized)
      button.innerHTML = this._isMinimized ? '+' : '−'
    }
  }

  onRemove(): void {
    this._miniMap?.remove()
    this._container?.parentNode?.removeChild(this._container)
  }
}

// Geocoder API using Nominatim
const geocoderApi = {
  forwardGeocode: async (config: { query: string }) => {
    const features: Array<{
      type: string
      geometry: { type: string; coordinates: [number, number] }
      place_name: string
      properties: Record<string, unknown>
      center: [number, number]
      bbox?: [number, number, number, number]
    }> = []

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(config.query)}&format=geojson&polygon_geojson=1&addressdetails=1`
      )
      const data = await response.json()

      for (const feature of data.features) {
        const center = feature.bbox
          ? [
              (feature.bbox[0] + feature.bbox[2]) / 2,
              (feature.bbox[1] + feature.bbox[3]) / 2,
            ]
          : feature.geometry.coordinates

        features.push({
          type: 'Feature',
          geometry: feature.geometry,
          place_name: feature.properties.display_name,
          properties: feature.properties,
          center: center as [number, number],
          bbox: feature.bbox,
        })
      }
    } catch (e) {
      console.error('Geocoding error:', e)
    }

    return { features }
  },
}

// Custom Geocoder Control (simple search box)
class GeocoderControl implements IControl {
  private _container: HTMLDivElement | undefined
  private _map: maplibregl.Map | undefined
  private _input: HTMLInputElement | undefined
  private _resultsContainer: HTMLDivElement | undefined
  private _isExpanded = false

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-geocoder'

    // Search button
    const searchBtn = document.createElement('button')
    searchBtn.className = 'geocoder-toggle'
    searchBtn.type = 'button'
    searchBtn.title = 'Search location'
    searchBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
    searchBtn.addEventListener('click', () => this.toggleExpand())
    this._container.appendChild(searchBtn)

    // Input wrapper
    const inputWrapper = document.createElement('div')
    inputWrapper.className = 'geocoder-input-wrapper'

    this._input = document.createElement('input')
    this._input.type = 'text'
    this._input.placeholder = 'Search location...'
    this._input.className = 'geocoder-input'
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.search()
      }
    })
    inputWrapper.appendChild(this._input)
    this._container.appendChild(inputWrapper)

    // Results container
    this._resultsContainer = document.createElement('div')
    this._resultsContainer.className = 'geocoder-results'
    this._container.appendChild(this._resultsContainer)

    return this._container
  }

  toggleExpand(): void {
    this._isExpanded = !this._isExpanded
    this._container?.classList.toggle('expanded', this._isExpanded)
    if (this._isExpanded) {
      this._input?.focus()
    }
  }

  async search(): Promise<void> {
    if (!this._input || !this._map || !this._resultsContainer) return

    const query = this._input.value.trim()
    if (!query) return

    const result = await geocoderApi.forwardGeocode({ query })

    this._resultsContainer.innerHTML = ''

    if (result.features.length === 0) {
      this._resultsContainer.innerHTML = '<div class="geocoder-no-results">No results found</div>'
      return
    }

    for (const feature of result.features.slice(0, 5)) {
      const item = document.createElement('div')
      item.className = 'geocoder-result-item'
      item.textContent = feature.place_name
      item.addEventListener('click', () => {
        if (feature.bbox) {
          this._map?.fitBounds(feature.bbox as [number, number, number, number], { padding: 50 })
        } else {
          this._map?.flyTo({ center: feature.center, zoom: 12 })
        }
        this._resultsContainer!.innerHTML = ''
        this._input!.value = ''
        this.toggleExpand()
      })
      this._resultsContainer.appendChild(item)
    }
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
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
    navigation?: maplibregl.NavigationControl
    scale?: maplibregl.ScaleControl
    geocoder?: GeocoderControl
    geolocate?: maplibregl.GeolocateControl
    minimap?: MiniMapControl
    draw?: MapboxDraw
    homeButton?: HomeButtonControl
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

    // Cleanup
    return () => {
      if (controlsRef.current.navigation) map.removeControl(controlsRef.current.navigation)
      if (controlsRef.current.scale) map.removeControl(controlsRef.current.scale)
      if (controlsRef.current.geocoder) map.removeControl(controlsRef.current.geocoder)
      if (controlsRef.current.geolocate) map.removeControl(controlsRef.current.geolocate)
      if (controlsRef.current.minimap) map.removeControl(controlsRef.current.minimap)
      if (controlsRef.current.draw) map.removeControl(controlsRef.current.draw as unknown as IControl)
      if (controlsRef.current.homeButton) map.removeControl(controlsRef.current.homeButton)
      controlsRef.current = {}
    }
  }, [map, setMapView, selectTweet, setFilter, setPage, setStateBefore, setVisibleTweetIds, tweetsData])

  return null
}
