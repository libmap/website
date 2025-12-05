import type { Layer, LayerGroup } from 'leaflet'

export interface LayerConfig {
  id: string
  name: string
  type: 'tile' | 'geojson' | 'marker' | 'custom'
  url?: string
  attribution?: string
  options?: Record<string, unknown>
  lazy?: boolean
  visible?: boolean
}

export interface LayerSet {
  id: string
  name: string
  type: 'base' | 'overlay'
  layers: LayerConfig[]
  expanded?: boolean
}

export interface LayerInstance {
  id: string
  config: LayerConfig
  layer: Layer | LayerGroup | null
  isLoading: boolean
  isLoaded: boolean
}

export interface LayersState {
  visible: string[]
  baseLayer: string
  sets: LayerSet[]
  instances: Map<string, LayerInstance>
}
