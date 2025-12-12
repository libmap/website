import type { StyleSpecification } from 'maplibre-gl'
import { BASE_TILES } from './baseTiles'
import type { BaseTileConfig } from './types'

const BASE_SOURCE_ID = 'base-tiles'
const BASE_LAYER_ID = 'base-layer'

// Get tiles array for a base tile config (handles subdomains and TMS)
export function getTilesForConfig(config: BaseTileConfig): string[] {
  if (!config.url || config.id === 'empty') {
    return []
  }

  let tiles: string[]
  if (config.subdomains && config.subdomains.length > 0) {
    tiles = config.subdomains.map((s: string) => config.url.replace('{s}', s))
  } else {
    tiles = [config.url.replace('{s}', '')]
  }

  // Handle TMS y-coordinate inversion (Nimbo uses {-y})
  tiles = tiles.map((url) => url.replace('{-y}', '{y}'))

  return tiles
}

// Create an empty base style - layers will be added dynamically by LayerManager
export function createEmptyStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e0e0e0' },
      },
    ],
  }
}

// Create initial style with a base layer already included
// This is used for initial map load to avoid a flash of empty map
export function createRasterStyle(config: BaseTileConfig): StyleSpecification {
  if (!config.url || config.id === 'empty') {
    return createEmptyStyle()
  }

  const tiles = getTilesForConfig(config)

  return {
    version: 8,
    projection: {
      type: 'globe',
    },
    sources: {
      [BASE_SOURCE_ID]: {
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
        id: BASE_LAYER_ID,
        type: 'raster',
        source: BASE_SOURCE_ID,
        paint: {
          'raster-opacity': config.opacity ?? 1,
        },
      },
    ],
    // sky: {
    //   'atmosphere-blend': [
    //     'interpolate',
    //     ['linear'],
    //     ['zoom'],
    //     0,
    //     1,
    //     5,
    //     1,
    //     7,
    //     0,
    //   ],
    // },
    // light: {
    //   anchor: 'map',
    //   position: [1.5, 90, 80],
    // },
    // fog: {
    //   range: [0.5, 10],
    //   color: 'rgba(186, 210, 235, 0.8)',
    //   'horizon-blend': 0.1,
    //   'high-color': '#add8e6',
    //   'space-color': '#d8f2ff',
    // },
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
