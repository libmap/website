import type { OverlayConfig } from './types'

const LAYER_DATA_URL = 'https://raw.githubusercontent.com/decarbnow/data/master/layers'

// Generate NO2 yearly tile layers
const NO2_YEARS = [2018, 2019, 2020, 2021]
const no2YearlyLayers: OverlayConfig[] = NO2_YEARS.map((year) => ({
  id: `no2_${year}`,
  name: `NO₂ ${year}`,
  type: 'tile' as const,
  url: `${LAYER_DATA_URL}/no2/tiles/reds/yearly/${year}/{z}/{x}/{y}.png`,
  minZoom: 0,
  maxZoom: 10,
  maxNativeZoom: 7,
  opacity: 0.8,
}))

// Generate NO2 monthly tile layers
const NO2_MONTHS: [number, number][] = [
  [2018, 5],
  [2020, 2],
]
const no2MonthlyLayers: OverlayConfig[] = NO2_MONTHS.map(([year, month]) => ({
  id: `no2_${year}_${String(month).padStart(2, '0')}`,
  name: `NO₂ ${year}-${String(month).padStart(2, '0')}`,
  type: 'tile' as const,
  url: `${LAYER_DATA_URL}/no2/tiles/blues/monthly/${year}/${String(month).padStart(2, '0')}/{z}/{x}/{y}.png`,
  minZoom: 0,
  maxZoom: 10,
  maxNativeZoom: 7,
  opacity: 0.8,
}))

// Generate NO2 GeoJSON layers (older data)
const OMI_YEARS = [2007, 2011, 2015]
const no2GeoJSONLayers: OverlayConfig[] = OMI_YEARS.map((year) => ({
  id: `no2_geojson_${year}`,
  name: `NO₂ ${year} (GeoJSON)`,
  type: 'geojson' as const,
  url: `/no2/World_${year}_rastered.geojson`,
  hidden: true,
  style: {
    fillColor: '#FF0000',
    stroke: true,
    weight: 0.1,
    opacity: 0.7,
    color: '#F1EFE8',
    fillOpacity: 0.05,
  },
}))

export const OVERLAY_LAYERS: OverlayConfig[] = [
  ...no2YearlyLayers,
  ...no2MonthlyLayers,
  ...no2GeoJSONLayers,
  {
    id: 'empty',
    name: 'Disabled',
    type: 'tile',
    hidden: true,
  },
]

export function getOverlayById(id: string): OverlayConfig | undefined {
  return OVERLAY_LAYERS.find((layer) => layer.id === id)
}
