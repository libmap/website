import maplibregl from 'maplibre-gl'
import type { IControl } from 'maplibre-gl'
import type { MinimapOptions } from './types'

export class MiniMapControl implements IControl {
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
