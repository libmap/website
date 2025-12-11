import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'
import { BASE_TILES, OVERLAY_LAYERS, POINT_LAYERS, getFuelColor } from '@/lib/layers'
import { getStyleForBaseLayer } from '@/lib/layers/maplibreStyles'
import type { OverlayConfig, PointLayerConfig } from '@/lib/layers'

const DATA_BASE_URL = 'https://raw.githubusercontent.com/decarbnow/data/refs/heads/master/layers'

export function LayerManager() {
  const map = useStore((state) => state.map.instance)
  const visibleLayers = useStore((state) => state.layers.visible)

  const loadedLayersRef = useRef<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())
  const prevBaseLayerRef = useRef<string | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // Detect current base layer from visibleLayers
  const currentBaseLayer = visibleLayers.find((id) => BASE_TILES.some((t) => t.id === id)) ?? 'satellite'

  // Handle base layer changes
  useEffect(() => {
    if (!map) return

    // Initialize prevBaseLayerRef on first run (map already has initial style from useMap)
    if (prevBaseLayerRef.current === null) {
      prevBaseLayerRef.current = currentBaseLayer
      return
    }

    // Skip if base layer hasn't changed
    if (currentBaseLayer === prevBaseLayerRef.current) return

    // Set new base style - this will remove all layers
    map.setStyle(getStyleForBaseLayer(currentBaseLayer))

    // Re-add overlays after style loads
    map.once('style.load', () => {
      loadedLayersRef.current.clear()
      // Overlays will be re-added by the visibleLayers effect
    })

    prevBaseLayerRef.current = currentBaseLayer
  }, [map, currentBaseLayer])

  // Add an overlay tile layer
  const addOverlayTileLayer = useCallback(
    (config: OverlayConfig) => {
      if (!map || !config.url || loadedLayersRef.current.has(config.id)) return
      if (map.getSource(config.id)) return

      map.addSource(config.id, {
        type: 'raster',
        tiles: [config.url],
        tileSize: 256,
        maxzoom: config.maxNativeZoom ?? config.maxZoom ?? 22,
        minzoom: config.minZoom ?? 0,
        scheme: config.tms ? 'tms' : 'xyz',
      })

      map.addLayer({
        id: config.id,
        type: 'raster',
        source: config.id,
        paint: {
          'raster-opacity': config.opacity ?? 0.8,
        },
      })

      loadedLayersRef.current.add(config.id)
    },
    [map]
  )

  // Add GeoJSON overlay layer (for NO2 data)
  const addGeoJSONOverlay = useCallback(
    async (config: OverlayConfig) => {
      if (!map || !config.url || loadedLayersRef.current.has(config.id)) return
      if (map.getSource(config.id) || loadingRef.current.has(config.id)) return

      loadingRef.current.add(config.id)

      try {
        const url = config.url.startsWith('http') ? config.url : `${DATA_BASE_URL}${config.url}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to load ${config.url}`)

        const data = await response.json()

        if (!map.getSource(config.id)) {
          map.addSource(config.id, {
            type: 'geojson',
            data,
          })

          map.addLayer({
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
    },
    [map]
  )

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
  const getCircleColor = useCallback((config: PointLayerConfig): maplibregl.ExpressionSpecification | string => {
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
  }, [])

  // Add a GeoJSON point layer
  const addPointLayer = useCallback(
    async (config: PointLayerConfig) => {
      if (!map || loadedLayersRef.current.has(config.id)) return
      if (map.getSource(config.id) || loadingRef.current.has(config.id)) return

      loadingRef.current.add(config.id)

      const url = config.extern ? config.url : `${DATA_BASE_URL}/${config.url}`

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to load ${config.url}`)

        const data = await response.json()

        if (!map.getSource(config.id)) {
          map.addSource(config.id, {
            type: 'geojson',
            data,
          })

          // Add circle layer with zoom-based radius scaling
          map.addLayer({
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
          map.on('click', config.id, (e) => {
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
              .addTo(map)
          })

          // Change cursor on hover
          map.on('mouseenter', config.id, () => {
            map.getCanvas().style.cursor = 'pointer'
          })

          map.on('mouseleave', config.id, () => {
            map.getCanvas().style.cursor = ''
          })

          loadedLayersRef.current.add(config.id)
        }
      } catch (error) {
        console.error(`Error loading layer ${config.id}:`, error)
      } finally {
        loadingRef.current.delete(config.id)
      }
    },
    [map, getCircleColor, buildPopupContent]
  )

  // Remove a layer
  const removeLayer = useCallback(
    (layerId: string) => {
      if (!map) return

      // Remove event listeners
      try {
        map.off('click', layerId, () => {})
        map.off('mouseenter', layerId, () => {})
        map.off('mouseleave', layerId, () => {})
      } catch {
        // Ignore errors if handlers don't exist
      }

      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
      if (map.getSource(layerId)) {
        map.removeSource(layerId)
      }

      loadedLayersRef.current.delete(layerId)
    },
    [map]
  )

  // Main effect to manage layers
  useEffect(() => {
    if (!map) return

    // Wait for style to be loaded
    const handleStyleLoad = () => {
      const currentLayers = new Set(visibleLayers)

      // Remove layers that should not be visible
      for (const layerId of loadedLayersRef.current) {
        // Skip base layers - they're handled separately
        if (BASE_TILES.find((t) => t.id === layerId)) continue

        if (!currentLayers.has(layerId)) {
          removeLayer(layerId)
        }
      }

      // Add layers that should be visible
      for (const layerId of visibleLayers) {
        // Skip base tiles - handled by setStyle
        if (BASE_TILES.find((t) => t.id === layerId)) continue

        // Check overlay tiles
        const overlay = OVERLAY_LAYERS.find((o) => o.id === layerId)
        if (overlay) {
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
          addPointLayer(pointLayer)
        }
      }
    }

    if (map.isStyleLoaded()) {
      handleStyleLoad()
    } else {
      map.once('style.load', handleStyleLoad)
    }
  }, [map, visibleLayers, addOverlayTileLayer, addGeoJSONOverlay, addPointLayer, removeLayer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current) {
        popupRef.current.remove()
      }
      loadedLayersRef.current.clear()
    }
  }, [])

  return null
}
