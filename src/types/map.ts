import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl'

export interface Coordinates {
  lat: number
  lng: number
}

export interface MapState {
  center: Coordinates
  zoom: number
  bounds: LngLatBounds | null
}

export interface MapViewState extends MapState {
  map: MapLibreMap | null
}

export interface URLState {
  center: Coordinates
  zoom: number
  layers: string[]
  account?: string | undefined
  hashtag?: string | undefined
  polygon?: string | undefined // geohash encoded
  isPreview?: boolean | undefined
}
