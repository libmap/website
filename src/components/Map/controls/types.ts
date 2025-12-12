import type maplibregl from 'maplibre-gl'

export interface MinimapOptions {
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
