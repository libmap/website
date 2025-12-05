import type { LatLngBounds, Map as LeafletMap } from 'leaflet'

export interface Coordinates {
  lat: number
  lng: number
}

export interface MapState {
  center: Coordinates
  zoom: number
  bounds: LatLngBounds | null
}

export interface MapViewState extends MapState {
  map: LeafletMap | null
}

export interface URLState {
  center: Coordinates
  zoom: number
  layers: string[]
  tweetId?: string | undefined
  account?: string | undefined
  hashtag?: string | undefined
  polygon?: string | undefined // geohash encoded
}
