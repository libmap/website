import { useEffect, useRef } from 'react'
import maplibregl, { IControl } from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useStore } from '@/store'
import { BASE_TILES } from '@/lib/layers'

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
    button.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>'
    button.addEventListener('click', this._onClick)

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}

// Custom Globe Button Control
class GlobeButtonControl implements IControl {
  private _container: HTMLDivElement | undefined
  private _button: HTMLButtonElement | undefined
  private _map: maplibregl.Map | undefined
  private _isGlobe = false

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    this._button = document.createElement('button')
    this._button.className = 'maplibregl-ctrl-globe'
    this._button.type = 'button'
    this._button.title = 'Toggle 3D Globe'
    this._button.setAttribute('aria-label', 'Toggle 3D Globe')
    this._button.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
    this._button.addEventListener('click', () => this._toggleGlobe())

    this._container.appendChild(this._button)
    return this._container
  }

  private _toggleGlobe(): void {
    if (!this._map) return

    this._isGlobe = !this._isGlobe

    this._map.setProjection({
      type: this._isGlobe ? 'globe' : 'mercator',
    })

    // Update button appearance
    if (this._button) {
      this._button.style.backgroundColor = this._isGlobe ? '#3b82f6' : ''
      this._button.style.color = this._isGlobe ? '#fff' : ''
    }
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}

// Custom MiniMap Control (based on mapboxgl-minimap)
interface MinimapOptions {
  id?: string
  width?: string
  height?: string
  style?: maplibregl.StyleSpecification
  center?: [number, number]
  zoom?: number
  zoomOffset?: number // How many zoom levels the minimap should be zoomed out compared to parent
  lineColor?: string
  lineWidth?: number
  lineOpacity?: number
  fillColor?: string
  fillOpacity?: number
  dragPan?: boolean
  scrollZoom?: boolean
  boxZoom?: boolean
  dragRotate?: boolean
  keyboard?: boolean
  doubleClickZoom?: boolean
  touchZoomRotate?: boolean
}

class MiniMapControl implements IControl {
  private _parentMap: maplibregl.Map | undefined
  private _miniMap: maplibregl.Map | undefined
  private _container: HTMLDivElement | undefined
  private _miniMapCanvas: HTMLElement | undefined
  private _trackingRect: maplibregl.GeoJSONSource | undefined
  private _trackingRectCoordinates: number[][][] = [[]]
  private _currentBounds: maplibregl.LngLatBounds | undefined
  private _isDragging = false
  private _isCursorOverFeature = false
  private _previousPoint: [number, number] = [0, 0]
  private _currentPoint: [number, number] = [0, 0]
  private _isMinimized = false

  private options: MinimapOptions = {
    id: 'maplibregl-minimap',
    width: '250px',
    height: '150px',
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
    center: [0, 0],
    zoom: 0,
    zoomOffset: 7, // Minimap will be 4 zoom levels more zoomed out than parent
    lineColor: '#136aec',
    lineWidth: 1,
    lineOpacity: 1,
    fillColor: '#3e8ee6',
    fillOpacity: 0.2,
    dragPan: false,
    scrollZoom: false,
    boxZoom: true,
    dragRotate: false,
    keyboard: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
  }

  constructor(options?: MinimapOptions) {
    if (options) {
      Object.assign(this.options, options)
    }
  }

  onAdd(parentMap: maplibregl.Map): HTMLElement {
    this._parentMap = parentMap

    const opts = this.options
    this._container = this._createContainer()

    // Mini map container
    const miniMapContainer = document.createElement('div')
    miniMapContainer.className = 'minimap-container'
    this._container.appendChild(miniMapContainer)

    // Toggle button
    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'minimap-toggle'
    toggleBtn.innerHTML = '-'
    toggleBtn.title = 'Toggle minimap'
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this._toggleMinimize(toggleBtn)
    })
    this._container.appendChild(toggleBtn)

    // Initialize mini map after container is in DOM
    setTimeout(() => {
      this._miniMap = new maplibregl.Map({
        attributionControl: false,
        container: miniMapContainer,
        style: opts.style!,
        zoom: opts.zoom!,
        center: opts.center!,
      })

      this._miniMap.on('load', () => this._load())
    }, 0)

    return this._container
  }

  private _load(): void {
    const opts = this.options
    const parentMap = this._parentMap!
    const miniMap = this._miniMap!

    // Disable interactions based on options
    if (!opts.dragPan) miniMap.dragPan.disable()
    if (!opts.scrollZoom) miniMap.scrollZoom.disable()
    if (!opts.boxZoom) miniMap.boxZoom.disable()
    if (!opts.dragRotate) miniMap.dragRotate.disable()
    if (!opts.keyboard) miniMap.keyboard.disable()
    if (!opts.doubleClickZoom) miniMap.doubleClickZoom.disable()
    if (!opts.touchZoomRotate) miniMap.touchZoomRotate.disable()

    const bounds = parentMap.getBounds()
    this._currentBounds = bounds
    this._convertBoundsToPoints(bounds)

    miniMap.addSource('trackingRect', {
      type: 'geojson',
      data: this._createTrackingRectGeoJSON(),
    })

    miniMap.addLayer({
      id: 'trackingRectOutline',
      type: 'line',
      source: 'trackingRect',
      layout: {},
      paint: {
        'line-color': opts.lineColor!,
        'line-width': opts.lineWidth!,
        'line-opacity': opts.lineOpacity!,
      },
    })

    // Needed for dragging
    miniMap.addLayer({
      id: 'trackingRectFill',
      type: 'fill',
      source: 'trackingRect',
      layout: {},
      paint: {
        'fill-color': opts.fillColor!,
        'fill-opacity': opts.fillOpacity!,
      },
    })

    this._trackingRect = miniMap.getSource('trackingRect') as maplibregl.GeoJSONSource

    this._update()

    parentMap.on('move', this._update.bind(this))

    miniMap.on('mousemove', this._mouseMove.bind(this))
    miniMap.on('mousedown', this._mouseDown.bind(this))
    miniMap.on('mouseup', this._mouseUp.bind(this))

    miniMap.on('touchmove', this._mouseMove.bind(this))
    miniMap.on('touchstart', this._mouseDown.bind(this))
    miniMap.on('touchend', this._mouseUp.bind(this))

    this._miniMapCanvas = miniMap.getCanvasContainer()
    this._miniMapCanvas.addEventListener('wheel', this._preventDefault)
    this._miniMapCanvas.addEventListener('mousewheel', this._preventDefault)
  }

  private _mouseDown(e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent): void {
    if (this._isCursorOverFeature) {
      this._isDragging = true
      this._previousPoint = this._currentPoint
      this._currentPoint = [e.lngLat.lng, e.lngLat.lat]
    }
  }

  private _mouseMove(e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent): void {
    const miniMap = this._miniMap!

    const features = miniMap.queryRenderedFeatures(e.point, {
      layers: ['trackingRectFill'],
    })

    // Don't update if we're still hovering the area
    if (!(this._isCursorOverFeature && features.length > 0)) {
      this._isCursorOverFeature = features.length > 0
      if (this._miniMapCanvas) {
        this._miniMapCanvas.style.cursor = this._isCursorOverFeature ? 'move' : ''
      }
    }

    if (this._isDragging) {
      this._previousPoint = this._currentPoint
      this._currentPoint = [e.lngLat.lng, e.lngLat.lat]

      const offset: [number, number] = [
        this._previousPoint[0] - this._currentPoint[0],
        this._previousPoint[1] - this._currentPoint[1],
      ]

      const newBounds = this._moveTrackingRect(offset)

      this._parentMap!.fitBounds(newBounds, {
        duration: 80,
      })
    }
  }

  private _mouseUp(): void {
    this._isDragging = false
  }

  private _moveTrackingRect(offset: [number, number]): maplibregl.LngLatBounds {
    const source = this._trackingRect!
    const bounds = this._currentBounds!

    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()

    const newNe = new maplibregl.LngLat(ne.lng - offset[0], ne.lat - offset[1])
    const newSw = new maplibregl.LngLat(sw.lng - offset[0], sw.lat - offset[1])
    const newBounds = new maplibregl.LngLatBounds(newSw, newNe)

    this._convertBoundsToPoints(newBounds)
    this._currentBounds = newBounds

    source.setData(this._createTrackingRectGeoJSON())

    return newBounds
  }

  private _setTrackingRectBounds(bounds: maplibregl.LngLatBounds): void {
    const source = this._trackingRect
    if (!source) return

    this._currentBounds = bounds
    this._convertBoundsToPoints(bounds)
    source.setData(this._createTrackingRectGeoJSON())
  }

  private _convertBoundsToPoints(bounds: maplibregl.LngLatBounds): void {
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()

    this._trackingRectCoordinates[0] = [
      [ne.lng, ne.lat],
      [sw.lng, ne.lat],
      [sw.lng, sw.lat],
      [ne.lng, sw.lat],
      [ne.lng, ne.lat],
    ]
  }

  private _createTrackingRectGeoJSON(): GeoJSON.Feature<GeoJSON.Polygon> {
    return {
      type: 'Feature',
      properties: {
        name: 'trackingRect',
      },
      geometry: {
        type: 'Polygon',
        coordinates: this._trackingRectCoordinates,
      },
    }
  }

  private _update(): void {
    if (this._isDragging || !this._parentMap) {
      return
    }

    const parentBounds = this._parentMap.getBounds()
    this._setTrackingRectBounds(parentBounds)

    this._zoomAdjust()
  }

  private _zoomAdjust(): void {
    const miniMap = this._miniMap
    const parentMap = this._parentMap
    if (!miniMap || !parentMap) return

    // Minimap zoom is always zoomOffset levels below parent, with a minimum of 0
    const zoomOffset = this.options.zoomOffset ?? 4
    const targetZoom = Math.max(0, parentMap.getZoom() - zoomOffset)
    miniMap.setZoom(targetZoom)
    miniMap.setCenter(parentMap.getCenter())
  }

  private _createContainer(): HTMLDivElement {
    const opts = this.options
    const container = document.createElement('div')

    container.className = 'maplibregl-ctrl maplibregl-ctrl-minimap'
    container.setAttribute('style', `width: ${opts.width}; height: ${opts.height};`)
    container.addEventListener('contextmenu', this._preventDefault)

    if (opts.id !== '') {
      container.id = opts.id!
    }

    return container
  }

  private _preventDefault(e: Event): void {
    e.preventDefault()
  }

  private _toggleMinimize(button: HTMLButtonElement): void {
    this._isMinimized = !this._isMinimized
    if (this._container) {
      this._container.classList.toggle('minimized', this._isMinimized)
      button.innerHTML = this._isMinimized ? '+' : '-'
    }
    // Trigger resize after toggle to fix any rendering issues
    setTimeout(() => {
      this._miniMap?.resize()
    }, 100)
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
          ? [(feature.bbox[0] + feature.bbox[2]) / 2, (feature.bbox[1] + feature.bbox[3]) / 2]
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
    searchBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
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
      const baseLayerIds = BASE_TILES.map((t) => t.id)
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
