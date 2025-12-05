import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import { useStore } from '@/store'
import { BASE_TILES, OVERLAY_LAYERS, POINT_LAYERS, getFuelColor } from '@/lib/layers'
import type { BaseTileConfig, OverlayConfig, PointLayerConfig } from '@/lib/layers'

const DATA_BASE_URL = 'https://raw.githubusercontent.com/decarbnow/data/master'

export function LayerManager() {
  const map = useStore((state) => state.map.instance)
  const visibleLayers = useStore((state) => state.layers.visible)

  const layersRef = useRef<Map<string, L.Layer>>(new Map())
  const loadingRef = useRef<Set<string>>(new Set())

  // Create a tile layer from config
  const createTileLayer = useCallback((config: BaseTileConfig): L.TileLayer | null => {
    if (!config.url || config.id === 'empty') return null

    return L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      subdomains: config.subdomains,
    })
  }, [])

  // Create an overlay tile layer
  const createOverlayTileLayer = useCallback((config: OverlayConfig): L.TileLayer | null => {
    if (!config.url || config.type !== 'tile') return null

    return L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      minZoom: config.minZoom,
      opacity: config.opacity ?? 1,
      tms: config.tms,
    })
  }, [])

  // Calculate marker radius based on zoom
  const getRadiusForZoom = useCallback((zoom: number): number => {
    const radiusMap: Record<number, number> = {
      1: 1,
      2: 1,
      3: 1.5,
      4: 2,
      5: 2.5,
      6: 3,
      7: 4,
      8: 5,
      9: 6,
      10: 8,
      11: 10,
      12: 12,
      13: 14,
      14: 16,
      15: 18,
      16: 20,
      17: 22,
      18: 24,
    }
    return radiusMap[zoom] ?? 6
  }, [])

  // Load and create a GeoJSON point layer
  const loadPointLayer = useCallback(
    async (config: PointLayerConfig): Promise<L.GeoJSON | null> => {
      if (!map) return null

      const url = config.extern ? config.url : `${DATA_BASE_URL}/${config.url}`

      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to load ${config.url}`)

        const data = await response.json()
        const zoom = map.getZoom()
        const baseRadius = getRadiusForZoom(zoom)

        const layer = L.geoJSON(data, {
          pointToLayer: (feature, latlng) => {
            const props = feature.properties as Record<string, unknown>
            let radius = baseRadius
            let opacity = 0.6
            let color = config.color

            // Adjust radius based on rank if available
            if (typeof props.rank_world === 'number') {
              radius = Math.max(baseRadius, baseRadius * (3 / Math.pow(props.rank_world, 0.25)))
            } else if (typeof props.rank === 'number') {
              radius = Math.max(baseRadius, baseRadius * (3 / Math.pow(props.rank, 0.25)))
            } else if (typeof props.population === 'number') {
              radius = Math.max(baseRadius, baseRadius * (Math.pow(props.population, 0.25) / 20))
            }

            // Adjust opacity based on emissions/capacity
            if (typeof props.emissions_quantity === 'number') {
              opacity = Math.min(0.85, Math.max(0.3, props.emissions_quantity / 20000000))
            } else if (typeof props.capacity_mw === 'number') {
              opacity = Math.min(0.4, Math.max(0.3, props.capacity_mw / 5000))
            }

            // Use fuel-specific color for power plants/energy
            if (typeof props.primary_fuel === 'string') {
              color = getFuelColor(props.primary_fuel)
            } else if (typeof props.asset_type === 'string' && config.id === 'energy') {
              color = getFuelColor(props.asset_type)
            }

            return L.circleMarker(latlng, {
              radius,
              stroke: true,
              weight: opacity * 3,
              fillOpacity: 0,
              color,
            })
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties as Record<string, unknown>
            const coords = (feature.geometry as GeoJSON.Point).coordinates

            let popupContent = '<table class="styled-table"><tbody>'

            // Build popup based on available properties
            if (props.asset_name || props.name || props.FacilityName || props.city) {
              const name = props.asset_name || props.name || props.FacilityName || props.city
              popupContent += `<tr><td>Name:</td><td>${name}</td></tr>`
            }

            if (props.asset_type || props.primary_fuel || props.activity) {
              const type = props.asset_type || props.primary_fuel || props.activity
              popupContent += `<tr><td>Type:</td><td>${type}</td></tr>`
            }

            if (typeof props.emissions_quantity === 'number') {
              const mio = (props.emissions_quantity / 1000000).toFixed(2)
              popupContent += `<tr><td>CO2-Equiv.:</td><td>${mio} Mio. T</td></tr>`
            }

            if (typeof props.capacity_mw === 'number') {
              popupContent += `<tr><td>Capacity:</td><td>${props.capacity_mw.toLocaleString()} MW</td></tr>`
            }

            if (typeof props.population === 'number') {
              popupContent += `<tr><td>Population:</td><td>${props.population.toLocaleString()}</td></tr>`
            }

            if (props.country || props.registry) {
              popupContent += `<tr><td>Country:</td><td>${props.country || props.registry}</td></tr>`
            }

            if (typeof props.rank === 'number' || typeof props.rank_world === 'number') {
              const rank = props.rank_world ?? props.rank
              popupContent += `<tr><td>Rank:</td><td>${rank}</td></tr>`
            }

            if (props.year || props.ReportingYear) {
              popupContent += `<tr><td>Year:</td><td>${props.year || props.ReportingYear}</td></tr>`
            }

            // Google Maps link
            if (coords && coords.length >= 2) {
              const gmapsUrl = `https://www.google.com/maps/place/${coords[1]},${coords[0]}/@${coords[1]},${coords[0]},1500m/data=!3m1!1e3`
              popupContent += `<tr><td>Get there:</td><td><a href="${gmapsUrl}" target="_blank">Google Maps</a></td></tr>`
            }

            popupContent += '</tbody></table>'
            layer.bindPopup(popupContent, { maxWidth: 350 })
          },
        })

        // Update circle sizes on zoom
        map.on('zoomend', () => {
          const newZoom = map.getZoom()
          const newRadius = getRadiusForZoom(newZoom)
          layer.eachLayer((l) => {
            if (l instanceof L.CircleMarker) {
              // Scale proportionally to original ratio
              const currentRadius = l.getRadius()
              const scaleFactor = newRadius / baseRadius
              l.setRadius(Math.max(newRadius, currentRadius * scaleFactor * 0.8))
            }
          })
        })

        return layer
      } catch (error) {
        console.error(`Error loading layer ${config.id}:`, error)
        return null
      }
    },
    [map, getRadiusForZoom]
  )

  // Main effect to manage layers
  useEffect(() => {
    if (!map) return

    const updateLayers = async () => {
      const currentLayers = new Set(visibleLayers)

      // Remove layers that are no longer visible
      for (const [layerId, layer] of layersRef.current.entries()) {
        if (!currentLayers.has(layerId)) {
          map.removeLayer(layer)
          layersRef.current.delete(layerId)
        }
      }

      // Add/update layers that should be visible
      for (const layerId of visibleLayers) {
        // Skip if already loaded or currently loading
        if (layersRef.current.has(layerId) || loadingRef.current.has(layerId)) {
          continue
        }

        // Check base tiles
        const baseTile = BASE_TILES.find((t) => t.id === layerId)
        if (baseTile) {
          const layer = createTileLayer(baseTile)
          if (layer) {
            layer.addTo(map)
            layersRef.current.set(layerId, layer)
          }
          continue
        }

        // Check overlay tiles
        const overlay = OVERLAY_LAYERS.find((o) => o.id === layerId)
        if (overlay && overlay.type === 'tile') {
          const layer = createOverlayTileLayer(overlay)
          if (layer) {
            layer.addTo(map)
            layersRef.current.set(layerId, layer)
          }
          continue
        }

        // Check point layers
        const pointLayer = POINT_LAYERS.find((p) => p.id === layerId)
        if (pointLayer) {
          loadingRef.current.add(layerId)
          const layer = await loadPointLayer(pointLayer)
          loadingRef.current.delete(layerId)

          if (layer && currentLayers.has(layerId)) {
            layer.addTo(map)
            layersRef.current.set(layerId, layer)
          }
        }
      }
    }

    updateLayers()
  }, [map, visibleLayers, createTileLayer, createOverlayTileLayer, loadPointLayer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        for (const layer of layersRef.current.values()) {
          map.removeLayer(layer)
        }
      }
      layersRef.current.clear()
    }
  }, [map])

  return null
}
