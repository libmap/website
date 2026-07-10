import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'
import { BASE_TILES, OVERLAY_LAYERS, POINT_LAYERS, getFuelColor } from '@/lib/layers'
import type { OverlayConfig, PointLayerConfig, BaseTileConfig } from '@/lib/layers'

const DATA_BASE_URL = 'https://raw.githubusercontent.com/decarbnow/data/refs/heads/master/layers'
const BASE_SOURCE_ID = 'base-tiles'
const BASE_LAYER_ID = 'base-layer'

export function LayerManager() {
  const map = useStore((state) => state.map.instance)
  const visibleLayers = useStore((state) => state.layers.visible)

  const loadedLayersRef = useRef<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())
  const prevBaseLayerRef = useRef<string | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const closePopups = useStore((state) => state.ui.closePopups)

  // Detect current base layer from visibleLayers
  const currentBaseLayer =
    visibleLayers.find((id) => BASE_TILES.some((t) => t.id === id)) ?? 'satellite'

  // Get tiles array for a base tile config (handles subdomains)
  const getTilesForConfig = useCallback((config: BaseTileConfig): string[] => {
    if (!config.url || config.id === 'empty') {
      return []
    }

    let tiles: string[]
    if (config.subdomains && config.subdomains.length > 0) {
      tiles = config.subdomains.map((s: string) => config.url.replace('{s}', s))
    } else {
      tiles = [config.url.replace('{s}', '')]
    }

    // Handle TMS y-coordinate inversion
    tiles = tiles.map((url) => url.replace('{-y}', '{y}'))

    return tiles
  }, [])

  // Track current base layer scheme to detect when we need to recreate the source
  const currentSchemeRef = useRef<'tms' | 'xyz'>('xyz')

  // Update base layer source tiles (MapLibre standard approach - no setStyle)
  const updateBaseLayer = useCallback(
    (layerId: string) => {
      if (!map) return

      const config = BASE_TILES.find((t) => t.id === layerId)
      if (!config) return

      const source = map.getSource(BASE_SOURCE_ID) as maplibregl.RasterTileSource | undefined
      const newScheme = config.tms ? 'tms' : 'xyz'

      if (config.id === 'empty' || !config.url) {
        // Hide base layer for empty/disabled
        if (map.getLayer(BASE_LAYER_ID)) {
          map.setLayoutProperty(BASE_LAYER_ID, 'visibility', 'none')
        }
        return
      }

      const tiles = getTilesForConfig(config)

      // Check if scheme changed - if so, we need to recreate the source
      // because MapLibre doesn't allow changing the scheme of an existing source
      const schemeChanged = source && currentSchemeRef.current !== newScheme

      if (source && !schemeChanged) {
        // Update existing source with new tiles (scheme is the same)
        source.setTiles(tiles)

        // Ensure base layer is visible
        if (map.getLayer(BASE_LAYER_ID)) {
          map.setLayoutProperty(BASE_LAYER_ID, 'visibility', 'visible')
          map.setPaintProperty(BASE_LAYER_ID, 'raster-opacity', config.opacity ?? 1)
        }
      } else {
        // Need to recreate source (either doesn't exist or scheme changed)
        if (source) {
          // Remove existing layer and source
          if (map.getLayer(BASE_LAYER_ID)) {
            map.removeLayer(BASE_LAYER_ID)
          }
          map.removeSource(BASE_SOURCE_ID)
        }

        // Add new source with correct scheme
        map.addSource(BASE_SOURCE_ID, {
          type: 'raster',
          tiles,
          tileSize: 256,
          maxzoom: config.maxNativeZoom ?? config.maxZoom ?? 20,
          scheme: newScheme,
        })

        // Add base layer at the bottom (before all other layers)
        const firstLayerId = map.getStyle().layers?.[0]?.id
        map.addLayer(
          {
            id: BASE_LAYER_ID,
            type: 'raster',
            source: BASE_SOURCE_ID,
            paint: {
              'raster-opacity': config.opacity ?? 1,
            },
          },
          firstLayerId
        )

        currentSchemeRef.current = newScheme
      }
    },
    [map, getTilesForConfig]
  )

  // Add an overlay tile layer
  const addOverlayTileLayer = useCallback((config: OverlayConfig) => {
    const mapInstance = useStore.getState().map.instance
    if (!mapInstance || !config.url || loadedLayersRef.current.has(config.id)) return
    if (mapInstance.getSource(config.id)) return

    console.log('[LayerManager] addOverlayTileLayer executing for:', config.id)

    mapInstance.addSource(config.id, {
      type: 'raster',
      tiles: [config.url],
      tileSize: 256,
      maxzoom: config.maxNativeZoom ?? config.maxZoom ?? 22,
      minzoom: config.minZoom ?? 0,
      scheme: config.tms ? 'tms' : 'xyz',
    })

    mapInstance.addLayer({
      id: config.id,
      type: 'raster',
      source: config.id,
      minzoom: config.minZoom ?? 0,
      maxzoom: config.maxZoom ?? 22,
      paint: {
        'raster-opacity': config.opacity ?? 0.8,
      },
    })

    loadedLayersRef.current.add(config.id)
  }, [])

  // Add GeoJSON overlay layer (for NO2 data)
  const addGeoJSONOverlay = useCallback(async (config: OverlayConfig) => {
    const mapInstance = useStore.getState().map.instance
    if (!mapInstance || !config.url || loadedLayersRef.current.has(config.id)) return
    if (mapInstance.getSource(config.id) || loadingRef.current.has(config.id)) return

    loadingRef.current.add(config.id)

    try {
      const url = config.url.startsWith('http') ? config.url : `${DATA_BASE_URL}${config.url}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to load ${config.url}`)

      const data = await response.json()

      // Re-check map instance as this is async
      const currentMap = useStore.getState().map.instance
      if (currentMap && !currentMap.getSource(config.id)) {
        currentMap.addSource(config.id, {
          type: 'geojson',
          data,
        })

        currentMap.addLayer({
          id: config.id,
          type: 'fill',
          source: config.id,
          paint: {
            'fill-color': config.style?.fillColor ?? '#FF0000',
            'fill-opacity': config.style?.fillOpacity ?? 0.05,
            'fill-outline-color': config.style?.color ?? '#F1EFE8',
          },
        })

        loadedLayersRef.current.add(config.id)
      }
    } catch (error) {
      console.error(`Error loading overlay ${config.id}:`, error)
    } finally {
      loadingRef.current.delete(config.id)
    }
  }, [])

  // Build popup content for point features
  const buildPopupContent = useCallback(
    (props: Record<string, unknown>, coords: number[]): string => {
      let content = '<table class="styled-table"><tbody>'

      if (props.asset_name || props.name || props.FacilityName || props.city) {
        const name = props.asset_name || props.name || props.FacilityName || props.city
        content += `<tr><td>Name:</td><td>${name}</td></tr>`
      }

      if (props.asset_type || props.primary_fuel || props.activity) {
        const type = props.asset_type || props.primary_fuel || props.activity
        content += `<tr><td>Type:</td><td>${type}</td></tr>`
      }

      if (typeof props.emissions_quantity === 'number') {
        const mio = (props.emissions_quantity / 1000000).toFixed(2)
        content += `<tr><td>CO2-Equiv.:</td><td>${mio} Mio. T</td></tr>`
      }

      if (typeof props.capacity_mw === 'number') {
        content += `<tr><td>Capacity:</td><td>${props.capacity_mw.toLocaleString()} MW</td></tr>`
      }

      if (typeof props.population === 'number') {
        content += `<tr><td>Population:</td><td>${props.population.toLocaleString()}</td></tr>`
      }

      if (props.country || props.registry) {
        content += `<tr><td>Country:</td><td>${props.country || props.registry}</td></tr>`
      }

      if (typeof props.rank === 'number' || typeof props.rank_world === 'number') {
        const rank = props.rank_world ?? props.rank
        content += `<tr><td>Rank:</td><td>${rank}</td></tr>`
      }

      if (props.year || props.ReportingYear) {
        content += `<tr><td>Year:</td><td>${props.year || props.ReportingYear}</td></tr>`
      }

      // Google Maps link
      if (coords && coords.length >= 2) {
        const gmapsUrl = `https://www.google.com/maps/place/${coords[1]},${coords[0]}/@${coords[1]},${coords[0]},1500m/data=!3m1!1e3`
        content += `<tr><td>Get there:</td><td><a href="${gmapsUrl}" target="_blank">Google Maps</a></td></tr>`
      }

      content += '</tbody></table>'
      return content
    },
    []
  )

  // Get circle color expression for a layer
  const getCircleColor = useCallback(
    (config: PointLayerConfig): maplibregl.ExpressionSpecification | string => {
      if (config.id === 'energy' || config.id === 'power-plants') {
        return [
          'match',
          ['get', 'primary_fuel'],
          'Oil',
          getFuelColor('Oil'),
          'Coal',
          getFuelColor('Coal'),
          'Gas',
          getFuelColor('Gas'),
          'Gas/Oil',
          getFuelColor('Gas/Oil'),
          'Biomass',
          getFuelColor('Biomass'),
          config.color, // default
        ] as maplibregl.ExpressionSpecification
      }
      return config.color
    },
    []
  )

  // Add a GeoJSON point layer
  const addPointLayer = useCallback(
    async (config: PointLayerConfig) => {
      const mapInstance = useStore.getState().map.instance
      if (!mapInstance || loadedLayersRef.current.has(config.id)) return
      if (mapInstance.getSource(config.id) || loadingRef.current.has(config.id)) return

      loadingRef.current.add(config.id)

      const url = config.extern ? config.url : `${DATA_BASE_URL}/${config.url}`

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to load ${config.url}`)

        const data = await response.json()

        // Re-check map instance as this is async
        const currentMap = useStore.getState().map.instance
        if (currentMap && !currentMap.getSource(config.id)) {
          currentMap.addSource(config.id, {
            type: 'geojson',
            data,
          })

          // Add circle layer with zoom-based radius scaling
          currentMap.addLayer({
            id: config.id,
            type: 'circle',
            source: config.id,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                1,
                1,
                3,
                1.5,
                5,
                2.5,
                7,
                4,
                10,
                8,
                13,
                14,
                16,
                20,
                18,
                24,
              ],
              'circle-color': getCircleColor(config),
              'circle-opacity': 0.6,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': config.color,
              'circle-stroke-opacity': 0.8,
            },
          })

          // Add click handler for popups
          currentMap.on('click', config.id, (e) => {
            if (!e.features || e.features.length === 0) return

            const feature = e.features[0]
            if (!feature) return
            const props = (feature.properties ?? {}) as Record<string, unknown>
            const geometry = feature.geometry as GeoJSON.Point
            const coords = geometry.coordinates

            // Close existing popup
            if (popupRef.current) {
              popupRef.current.remove()
            }

            popupRef.current = new maplibregl.Popup({ maxWidth: '350px' })
              .setLngLat(coords as [number, number])
              .setHTML(buildPopupContent(props, coords))
              .addTo(currentMap)
          })

          // Change cursor on hover
          currentMap.on('mouseenter', config.id, () => {
            currentMap.getCanvas().style.cursor = 'pointer'
          })

          currentMap.on('mouseleave', config.id, () => {
            currentMap.getCanvas().style.cursor = ''
          })

          loadedLayersRef.current.add(config.id)
        }
      } catch (error) {
        console.error(`Error loading layer ${config.id}:`, error)
      } finally {
        loadingRef.current.delete(config.id)
      }
    },
    [getCircleColor, buildPopupContent]
  )

  // Remove a layer
  const removeLayer = useCallback((layerId: string) => {
    const mapInstance = useStore.getState().map.instance
    if (!mapInstance) return

    // Remove event listeners
    try {
      mapInstance.off('click', layerId, () => {})
      mapInstance.off('mouseenter', layerId, () => {})
      mapInstance.off('mouseleave', layerId, () => {})
    } catch {
      // Ignore errors if handlers don't exist
    }

    if (mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId)
    }
    if (mapInstance.getSource(layerId)) {
      mapInstance.removeSource(layerId)
    }

    loadedLayersRef.current.delete(layerId)
  }, [])

  // Handle base layer changes - update tiles without replacing the entire style
  useEffect(() => {
    if (!map) return

    // Skip if base layer hasn't changed
    if (currentBaseLayer === prevBaseLayerRef.current) return

    // Update base layer tiles (doesn't affect other layers)
    updateBaseLayer(currentBaseLayer)

    prevBaseLayerRef.current = currentBaseLayer
  }, [map, currentBaseLayer, updateBaseLayer])

  // Sync visible layers to map - this is the main layer management logic
  const syncLayers = useCallback(() => {
    const mapInstance = useStore.getState().map.instance
    if (!mapInstance || !mapInstance.isStyleLoaded()) {
      console.log('[LayerManager] syncLayers skipped - map not ready', {
        map: !!mapInstance,
        styleLoaded: mapInstance?.isStyleLoaded(),
      })
      return
    }

    console.log('[LayerManager] syncLayers running with visibleLayers:', visibleLayers)

    const currentLayers = new Set(visibleLayers)

    // Remove layers that should not be visible
    for (const layerId of loadedLayersRef.current) {
      // Skip base layer - handled separately
      if (layerId === BASE_LAYER_ID) continue
      if (BASE_TILES.find((t) => t.id === layerId)) continue

      if (!currentLayers.has(layerId)) {
        removeLayer(layerId)
      }
    }

    // Add layers that should be visible
    for (const layerId of visibleLayers) {
      // Skip base tiles - handled by updateBaseLayer
      if (BASE_TILES.find((t) => t.id === layerId)) continue

      // Skip 'tweets' - handled by TweetMarkers component
      if (layerId === 'tweets') continue

      // Check overlay tiles
      const overlay = OVERLAY_LAYERS.find((o) => o.id === layerId)
      if (overlay) {
        console.log('[LayerManager] adding overlay:', layerId, overlay.type)
        if (overlay.type === 'tile') {
          addOverlayTileLayer(overlay)
        } else if (overlay.type === 'geojson') {
          addGeoJSONOverlay(overlay)
        }
        continue
      }

      // Check point layers
      const pointLayer = POINT_LAYERS.find((p) => p.id === layerId)
      if (pointLayer) {
        console.log('[LayerManager] adding point layer:', layerId)
        addPointLayer(pointLayer)
      }
    }
  }, [visibleLayers, addOverlayTileLayer, addGeoJSONOverlay, addPointLayer, removeLayer])

  // Effect to manage overlay layers
  useEffect(() => {
    console.log('[LayerManager] overlay effect running', { map: !!map, visibleLayers })

    if (!map) return

    // The map.isStyleLoaded() can return false even after the 'load' event
    // if the style is still being processed. We need to handle both cases:
    // 1. Style is already loaded -> sync immediately
    // 2. Style is loading -> wait for 'idle' event which fires when map is ready

    const doSync = () => {
      console.log('[LayerManager] doSync called, isStyleLoaded:', map.isStyleLoaded())
      syncLayers()
    }

    if (map.isStyleLoaded()) {
      console.log('[LayerManager] style already loaded, calling syncLayers')
      doSync()
    } else {
      console.log('[LayerManager] style not loaded, waiting for idle event')
      // Use 'idle' event which fires when the map is fully rendered and ready
      // This is more reliable than 'style.load' which may have already fired
      map.once('idle', doSync)
      return () => {
        map.off('idle', doSync)
      }
    }
  }, [map, syncLayers, visibleLayers])

  // Close popup when requested
  useEffect(() => {
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }
  }, [closePopups])

  // Cleanup on unmount
  useEffect(() => {
    const loadedLayers = loadedLayersRef.current
    return () => {
      if (popupRef.current) {
        popupRef.current.remove()
      }
      loadedLayers.clear()
    }
  }, [])

  return null
}
