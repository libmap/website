import type { BaseTileConfig } from './types'

export const BASE_TILES: BaseTileConfig[] = [
  {
    id: 'satellite',
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
    attribution:
      '© <a href="https://maps.google.com">Google Maps</a>, ' +
      '<a href="https://disc.gsfc.nasa.gov/datasets/OMNO2d_003/summary?keywords=omi">NASA</a>, ' +
      '<a href="https://earth.esa.int/web/guest/missions/esa-eo-missions/sentinel-5p">ESA/Copernicus</a>',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  },
  {
    id: 'esri',
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '© <a href="https://www.esri.com/">Esri</a>, USGS, NASA, ESA, GE, Getmapping, Community',
    maxZoom: 20,
  },
  {
    id: 'streets',
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
      '<a href="https://disc.gsfc.nasa.gov/datasets/OMNO2d_003/summary?keywords=omi">NASA</a>, ' +
      '<a href="https://earth.esa.int/web/guest/missions/esa-eo-missions/sentinel-5p">ESA/Copernicus</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c'],
  },
  {
    id: 'light',
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
      '© <a href="https://carto.com/attribution">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
      '© <a href="https://carto.com/attribution">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'terrain',
    name: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — S: US NPS',
    maxZoom: 20,
  },
  {
    id: 'nightlight',
    name: 'Night Lights',
    url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/2012/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    attribution: 'Tiles © <a href="https://earthdata.nasa.gov">ESDIS</a> funded by NASA/HQ',
    maxZoom: 14,
    maxNativeZoom: 8,
  },
  {
    id: 'nimbo',
    name: 'Nimbo',
    url: 'https://prod-data.nimbo.earth/mapcache-free/tms/1.0.0/latest@kermap/{z}/{x}/{y}.png',
    attribution: 'Tiles © <a href="https://nimbo.earth/">Nimbo by Kermap</a>',
    maxZoom: 16,
    maxNativeZoom: 16,
    tms: true,
  },
  {
    id: 's2maps16',
    name: 'Sentinel-2 (2016, EOX)',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
    attribution:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
    maxZoom: 20,
  },
  {
    id: 'empty',
    name: 'Disabled',
    url: '',
    attribution: '',
    maxZoom: 20,
    hidden: true,
  },
]

export function getBaseTileById(id: string): BaseTileConfig | undefined {
  return BASE_TILES.find((tile) => tile.id === id)
}
