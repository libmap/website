import { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import type { Tweet } from '@/types'

// Marker icons based on tweet type
const MARKER_COLORS: Record<string, string> = {
  pollution: '#ef4444', // red
  climateaction: '#22c55e', // green
  transition: '#3b82f6', // blue
}

function createMarkerIcon(type: Tweet['type']): L.DivIcon {
  const color = MARKER_COLORS[type] ?? MARKER_COLORS.climateaction

  return L.divIcon({
    className: 'tweet-marker',
    html: `
      <div class="tweet-marker-pin" style="background-color: ${color}">
        <div class="tweet-marker-inner"></div>
      </div>
    `,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}

export function TweetMarkers() {
  const map = useStore((state) => state.map.instance)
  const visibleLayers = useStore((state) => state.layers.visible)
  const selectTweet = useStore((state) => state.selectTweet)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const filterByBounds = useStore((state) => state.tweets.filterByBounds)
  const frozenBounds = useStore((state) => state.tweets.frozenBounds)

  const { tweets, isLoading, updateVisibleTweets } = useTweets()

  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  const isTweetsVisible = visibleLayers.includes('tweets')

  // Filter tweets for markers based on filterByBounds setting
  // Use frozen bounds (captured when button clicked) instead of current bounds
  const tweetsToShow = useMemo(() => {
    if (!filterByBounds || !frozenBounds) {
      return tweets // Show all markers
    }
    // Filter to only tweets in frozen view
    return tweets.filter((tweet) => {
      const { lat, lng } = tweet.coordinates
      return frozenBounds.contains([lat, lng])
    })
  }, [tweets, filterByBounds, frozenBounds])

  // Create popup content for a tweet
  const createPopupContent = useCallback((tweet: Tweet): string => {
    return `
      <div class="tweet-popup">
        <div class="tweet-popup-header">
          <strong>${tweet.author}</strong>
          <span class="tweet-handle">@${tweet.authorHandle}</span>
        </div>
        <p class="tweet-text">${tweet.text}</p>
        <div class="tweet-popup-footer">
          <time>${new Date(tweet.createdAt).toLocaleDateString()}</time>
          <span class="tweet-type ${tweet.type}">${tweet.type}</span>
        </div>
        ${tweet.expandedUrl ? `<a href="${tweet.expandedUrl}" target="_blank" class="tweet-link">View original</a>` : ''}
      </div>
    `
  }, [])

  // Handle marker click
  const handleMarkerClick = useCallback(
    (tweet: Tweet) => {
      // Save current state for "back" navigation
      if (map) {
        const center = map.getCenter()
        setStateBefore({
          center: { lat: center.lat, lng: center.lng },
          zoom: map.getZoom(),
        })
      }

      selectTweet(tweet.id)

      // Fly to tweet location
      if (map) {
        map.flyTo([tweet.coordinates.lat, tweet.coordinates.lng], Math.max(map.getZoom(), 10), {
          duration: 1,
        })
      }
    },
    [map, selectTweet, setStateBefore]
  )

  // Create/update markers when tweets change
  useEffect(() => {
    if (!map || !isTweetsVisible) return

    // Create layer group if needed
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map)
    }

    const currentMarkers = markersRef.current
    const tweetIds = new Set(tweetsToShow.map((t) => t.id))

    // Remove markers for tweets that no longer exist or are filtered out
    for (const [id, marker] of currentMarkers.entries()) {
      if (!tweetIds.has(id)) {
        layerGroupRef.current.removeLayer(marker)
        currentMarkers.delete(id)
      }
    }

    // Add/update markers for each tweet to show
    for (const tweet of tweetsToShow) {
      if (currentMarkers.has(tweet.id)) {
        // Update existing marker if needed
        const marker = currentMarkers.get(tweet.id)!
        const pos = marker.getLatLng()
        if (pos.lat !== tweet.coordinates.lat || pos.lng !== tweet.coordinates.lng) {
          marker.setLatLng([tweet.coordinates.lat, tweet.coordinates.lng])
        }
      } else {
        // Create new marker
        const marker = L.marker([tweet.coordinates.lat, tweet.coordinates.lng], {
          icon: createMarkerIcon(tweet.type),
        })

        marker.bindPopup(createPopupContent(tweet), {
          maxWidth: 300,
          className: 'tweet-popup-container',
        })

        marker.on('click', () => handleMarkerClick(tweet))

        layerGroupRef.current.addLayer(marker)
        currentMarkers.set(tweet.id, marker)
      }
    }
  }, [map, tweetsToShow, isTweetsVisible, createPopupContent, handleMarkerClick])

  // Update visible tweets when map moves
  useEffect(() => {
    if (!map) return

    const handleMoveEnd = () => {
      updateVisibleTweets()
    }

    map.on('moveend', handleMoveEnd)
    return () => {
      map.off('moveend', handleMoveEnd)
    }
  }, [map, updateVisibleTweets])

  // Show/hide layer group based on visibility
  useEffect(() => {
    if (!map || !layerGroupRef.current) return

    if (isTweetsVisible) {
      if (!map.hasLayer(layerGroupRef.current)) {
        layerGroupRef.current.addTo(map)
      }
    } else {
      if (map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current)
      }
    }
  }, [map, isTweetsVisible])

  // Highlight active tweet marker
  useEffect(() => {
    if (!activeTweetId) return

    const marker = markersRef.current.get(activeTweetId)
    if (marker) {
      marker.openPopup()
    }
  }, [activeTweetId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map && layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
      }
      markersRef.current.clear()
      layerGroupRef.current = null
    }
  }, [map])

  if (isLoading) {
    return null
  }

  return null
}
