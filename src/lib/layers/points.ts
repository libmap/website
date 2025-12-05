import type { PointLayerConfig } from './types'

const CITATIONS = {
  climatetrace:
    'Climate TRACE - Tracking Real-time Atmospheric Carbon Emissions (2022), Climate TRACE Emissions Inventory, https://climatetrace.org [November 2022]',
  wri: 'Dataset coordinated by World Resource Institute and Google Earth Outreach.',
  eprtr:
    'The E-PRTR is a service managed by the European Commission and the European Environment Agency (EEA).',
  bigcities:
    "Simplemaps commercial database of the world's cities and towns built using authoritative sources.",
  euets:
    "The EU ETS is a cornerstone of the EU's policy to combat climate change and its key tool for reducing greenhouse gas emissions cost-effectively.",
}

export const POINT_LAYERS: PointLayerConfig[] = [
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    url: 'sectors/manufacturing/points.geojson',
    color: '#ad76ff',
    citation: CITATIONS.climatetrace,
  },
  {
    id: 'energy',
    name: 'Energy',
    url: 'sectors/energy/points.geojson',
    color: '#FF0000',
    citation: CITATIONS.climatetrace,
  },
  {
    id: 'fossil-fuel-operations',
    name: 'Fossil Fuel Operations',
    url: 'sectors/fossil_fuel_operations/points.geojson',
    color: '#FCB500',
    citation: CITATIONS.climatetrace,
  },
  {
    id: 'power-plants',
    name: 'WRI Power Plants',
    url: '/power-plants/points.geojson',
    color: '#FF0000',
    citation: CITATIONS.wri,
  },
  {
    id: 'e-prtr',
    name: 'E-PRTR',
    url: '/e-prtr/points.geojson',
    color: '#6600ff',
    hidden: true,
    citation: CITATIONS.eprtr,
  },
  {
    id: 'eu-ets',
    name: 'EU-ETS',
    url: '/eu-ets/points.geojson',
    color: '#6600ff',
    citation: CITATIONS.euets,
  },
  {
    id: 'big-cities',
    name: 'Big Cities',
    url: '/cities/points.geojson',
    color: '#39ff14',
    citation: CITATIONS.bigcities,
  },
  {
    id: 'fridaysforfuture',
    name: 'Fridays for Future',
    url: 'https://allforeco.github.io/fridaysforfuture/fff-global-map.json',
    color: '#00FF00',
    hidden: true,
    extern: true,
  },
]

export function getPointLayerById(id: string): PointLayerConfig | undefined {
  return POINT_LAYERS.find((layer) => layer.id === id)
}

// Helper function to get fuel color (for energy/power-plant layers)
export function getFuelColor(fuelType: string): string {
  switch (fuelType) {
    case 'Oil':
      return '#ffcf09'
    case 'Coal':
      return '#ff000d'
    case 'Gas':
      return '#6600ff'
    case 'Gas/Oil':
      return '#ffcf09'
    case 'Biomass':
      return '#fe01b1'
    default:
      return '#888888'
  }
}
