import { useCallback } from 'react'
import { useStore } from '@/store'
import type { URLState } from '@/types'

// Default map position (Vienna/Europe center)
export { buildUrl }
const DEFAULT_CENTER = { lat: 22.02455, lng: 0.08789 }
const DEFAULT_ZOOM = 3

const URL_CONFIG = {
  prefix: '/map',
  listDivider: ',',
}

/**
 * Parse URL string to extract map state
 * Format: /@account/~hashtag/map?ls=dark,tweets&z=4&lng=26.23535&lat=10.09867
 */
function parseUrlString(urlString: string): Partial<URLState> {
  const result: Partial<URLState> = {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    layers: ['satellite', 'tweets'],
  }

  try {
    // Handle relative URLs
    const url = new URL(urlString, 'https://libmap.org')
    const path = url.pathname
    const search = url.searchParams

    // Parse special keys from path (/@account, /~hashtag)
    const pathParts = path.split('/').filter(Boolean)
    for (const part of pathParts) {
      if (part.startsWith('@')) {
        result.account = part.slice(1)
      } else if (part.startsWith('~')) {
        result.hashtag = part.slice(1)
      }
    }

    // Parse query parameters
    const lat = search.get('lat')
    const lng = search.get('lng')
    const zoom = search.get('z')
    const layers = search.get('ls')
    const polygons = search.get('polygons')
    const preview = search.get('preview')

    if (lat && lng) {
      result.center = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      }
    }

    if (zoom) {
      result.zoom = parseInt(zoom, 10)
    }

    if (layers) {
      result.layers = layers.split(URL_CONFIG.listDivider).filter((l) => l !== 'empty')
    }

    if (polygons) {
      result.polygon = polygons
    }

    if (preview === '1' || preview === 'true') {
      result.isPreview = true
    }
  } catch (e) {
    console.error('Failed to parse URL:', urlString, e)
  }

  return result
}

/**
 * Parse current URL to extract map state
 * Format: /@account/~hashtag/map?ls=dark,tweets&z=4&lng=26.23535&lat=10.09867
 */
function parseUrl(): Partial<URLState> {
  return parseUrlString(window.location.pathname + window.location.search)
}

/**
 * Build URL from state
 * Format: /@account/~hashtag/map?ls=dark,tweets&z=4&lng=26.23535&lat=10.09867
 */
function buildUrl(state: URLState): string {
  const { center, zoom, layers, account, hashtag, polygon } = state

  // Build special keys path
  const specialParts: string[] = []
  if (account) {
    specialParts.push(`@${account}`)
  }
  if (hashtag) {
    specialParts.push(`~${hashtag}`)
  }

  const specialPath = specialParts.length > 0 ? '/' + specialParts.join('/') : ''

  // Build query parameters
  const params = new URLSearchParams()

  // Filter out 'empty' layers
  const validLayers = layers.filter((l) => l !== 'empty')
  if (validLayers.length > 0) {
    params.set('ls', validLayers.join(URL_CONFIG.listDivider))
  }

  params.set('z', zoom.toString())
  params.set('lng', center.lng.toFixed(5))
  params.set('lat', center.lat.toFixed(5))

  if (polygon) {
    params.set('polygons', polygon)
  }

  const queryString = params.toString()
  // Decode commas only in the ls (layers) parameter
  const decodedQuery = queryString.replace(
    /(ls=)([^&]*)/g,
    (_match, prefix, value) => prefix + value.replace(/%2C/g, ',')
  )
  return `${specialPath}${URL_CONFIG.prefix}?${decodedQuery}`
}

export function useUrlState() {
  const {
    setMapView,
    setVisibleLayers,
    setFilter,
    setInitialized,
    setDrawings,
    map,
    layers,
    tweets,
    drawings,
  } = useStore()

  const initFromUrl = useCallback(() => {
    const urlState = parseUrl()

    if (urlState.center && urlState.zoom !== undefined) {
      setMapView(urlState.center, urlState.zoom)
    }

    if (urlState.layers) {
      setVisibleLayers(urlState.layers)
    }

    if (urlState.account) {
      setFilter('account', urlState.account)
    }

    if (urlState.hashtag) {
      setFilter('hashtag', urlState.hashtag)
    }

    if (urlState.polygon) {
      setDrawings(urlState.polygon)
    }

    setInitialized(true)

    return urlState
  }, [setMapView, setVisibleLayers, setFilter, setInitialized, setDrawings])

  const syncToUrl = useCallback(() => {
    const state: URLState = {
      center: map.center,
      zoom: map.zoom,
      layers: layers.visible,
    }

    if (tweets.filters.account) {
      state.account = tweets.filters.account
    }
    if (tweets.filters.hashtag) {
      state.hashtag = tweets.filters.hashtag
    }
    if (drawings) {
      state.polygon = drawings
    }

    const url = buildUrl(state)
    window.history.replaceState({}, '', url)
  }, [map.center, map.zoom, layers.visible, tweets.filters, drawings])

  /**
   * Apply view from a URL string (e.g., from a tweet's URL)
   * This sets the layers, zoom, and center based on the URL
   */
  const applyViewFromUrl = useCallback(
    (urlString: string, animate = true) => {
      const urlState = parseUrlString(urlString)
      const mapInstance = useStore.getState().map.instance

      if (!mapInstance) return

      // Apply layers if specified
      if (urlState.layers && urlState.layers.length > 0) {
        setVisibleLayers(urlState.layers)
      }

      // Apply map view if center and zoom are specified
      if (urlState.center && urlState.zoom !== undefined) {
        if (animate) {
          mapInstance.flyTo({
            center: [urlState.center.lng, urlState.center.lat],
            zoom: urlState.zoom,
            duration: 1500,
          })
        } else {
          mapInstance.jumpTo({
            center: [urlState.center.lng, urlState.center.lat],
            zoom: urlState.zoom,
          })
        }
        setMapView(urlState.center, urlState.zoom)
      }

      // Apply filters if specified
      if (urlState.account) {
        setFilter('account', urlState.account)
      }
      if (urlState.hashtag) {
        setFilter('hashtag', urlState.hashtag)
      }

      // Apply drawn shapes if specified
      if (urlState.polygon) {
        setDrawings(urlState.polygon)
      }

      // Sync to URL
      syncToUrl()
    },
    [setMapView, setVisibleLayers, setFilter, setDrawings, syncToUrl]
  )

  return { initFromUrl, syncToUrl, applyViewFromUrl, parseUrl, buildUrl }
}
