import type L from 'leaflet'

export interface BaseTileConfig {
  id: string
  name: string
  url: string
  attribution: string
  maxZoom: number
  maxNativeZoom?: number
  subdomains?: string[]
  hidden?: boolean
  tms?: boolean
  opacity?: number
}

export interface OverlayConfig {
  id: string
  name: string
  type: 'tile' | 'geojson'
  url?: string
  hidden?: boolean
  attribution?: string
  maxZoom?: number
  maxNativeZoom?: number
  minZoom?: number
  opacity?: number
  tms?: boolean
  style?: L.PathOptions
}

export interface PointLayerConfig {
  id: string
  name: string
  url: string
  hidden?: boolean
  extern?: boolean
  color: string
  citation?: string
}

export interface LayerGroup {
  id: string
  name: string
  type: 'base' | 'overlay' | 'points'
  layers: string[]
}
