import type { StyleSpecification } from 'maplibre-gl'
import { BASE_TILES } from './baseTiles'
import type { BaseTileConfig } from './types'

export function createRasterStyle(config: BaseTileConfig): StyleSpecification {
  if (!config.url || config.id === 'empty') {
    return {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#f0f0f0' },
        },
      ],
    }
  }

  // Convert Leaflet URL template to MapLibre tiles array
  // Leaflet uses {s} for subdomains, MapLibre needs expanded URLs
  let tiles: string[]

  if (config.subdomains && config.subdomains.length > 0) {
    tiles = config.subdomains.map((s: string) => config.url.replace('{s}', s))
  } else {
    // Remove {s} placeholder if no subdomains defined
    tiles = [config.url.replace('{s}', '')]
  }

  // Handle TMS y-coordinate inversion (Nimbo uses {-y})
  tiles = tiles.map((url) => url.replace('{-y}', '{y}'))

  return {
    version: 8,
    sources: {
      'base-tiles': {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: config.maxNativeZoom ?? config.maxZoom,
        attribution: config.attribution,
        scheme: config.tms ? 'tms' : 'xyz',
      },
    },
    layers: [
      {
        id: 'base-layer',
        type: 'raster',
        source: 'base-tiles',
        paint: {
          'raster-opacity': config.opacity ?? 1,
        },
      },
    ],
  }
}

export function getStyleForBaseLayer(layerId: string): StyleSpecification {
  const config = BASE_TILES.find((t) => t.id === layerId)
  if (!config) {
    const defaultConfig = BASE_TILES[0]
    if (!defaultConfig) {
      // Fallback empty style
      return { version: 8, sources: {}, layers: [] }
    }
    return createRasterStyle(defaultConfig)
  }
  return createRasterStyle(config)
}

export function getAttributionForBaseLayer(layerId: string): string {
  const config = BASE_TILES.find((t) => t.id === layerId)
  return config?.attribution ?? ''
}
