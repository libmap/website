import { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory, getHeadTweetById } from '@/utils/stories'
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
  const pagination = useStore((state) => state.tweets.pagination)
  const allTweetsMap = useStore((state) => state.tweets.data)

  const { tweets: allTweets, visibleTweets, isLoading, updateVisibleTweets } = useTweets()
  const { applyViewFromUrl } = useUrlState()

  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  const isTweetsVisible = visibleLayers.includes('tweets')

  // Calculate which page a tweet (or its head tweet) should be on
  const calculatePageForTweet = useCallback(
    (tweetId: string): number => {
      // Get the head tweet ID for this tweet
      const headTweetId = getHeadTweetById(tweetId, allTweetsMap)
      if (!headTweetId) return 1

      // Find the index of the head tweet in visibleTweets
      const headTweetIndex = visibleTweets.findIndex((t) => t.id === headTweetId)
      if (headTweetIndex === -1) return 1

      // Calculate which page this tweet is on
      const pageNumber = Math.floor(headTweetIndex / pagination.perPage) + 1
      return pageNumber
    },
    [visibleTweets, allTweetsMap, pagination.perPage]
  )

  // Filter tweets to only show those in current sidebar page
  // Include both head tweets AND their story tweets
  const tweetsToShow = useMemo(() => {
    // Apply pagination to visible tweets (which are head tweets only)
    const start = (pagination.currentPage - 1) * pagination.perPage
    const end = start + pagination.perPage
    const paginatedHeadTweets = visibleTweets.slice(start, end)

    // Also include all story tweets for these head tweets
    const allTweetsToShow: Tweet[] = []

    paginatedHeadTweets.forEach((headTweet) => {
      // Add the head tweet
      allTweetsToShow.push(headTweet)

      // Add all story tweets for this head tweet
      const storyTweets = getTweetsOfStory(allTweets, headTweet.id)
      allTweetsToShow.push(...storyTweets)
    })

    return allTweetsToShow
  }, [visibleTweets, pagination.currentPage, pagination.perPage, allTweets])

  // Create popup content for a tweet
  const createPopupContent = useCallback((tweet: Tweet): string => {
    // For Mastodon, text already contains HTML - use it directly
    // For other sources, escape HTML entities for security
    const displayText =
      tweet.source === 'mastodon.social'
        ? tweet.text
        : tweet.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    return `
      <div class="tweet-popup">
        <div class="tweet-popup-header">
          <strong>${tweet.author}</strong>
          <span class="tweet-handle">@${tweet.authorHandle}</span>
        </div>
        <p class="tweet-text">${displayText}</p>
        <div class="tweet-popup-footer">
          <time>${new Date(tweet.createdAt).toLocaleDateString()}</time>
          <span class="tweet-type ${tweet.type}">${tweet.type}</span>
        </div>
        <button class="tweet-activate-btn" data-tweet-id="${tweet.id}">View Details</button>
      </div>
    `
  }, [])

  // Handle marker click - only select tweet, no navigation
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
    },
    [map, selectTweet, setStateBefore]
  )

  // Handle full activation - matches sidebar behavior exactly
  const handleTweetActivation = useCallback(
    (tweet: Tweet) => {
      if (!map) return

      // Calculate which page this tweet should be on
      const tweetPage = calculatePageForTweet(tweet.id)

      // Save current state for back navigation (including calculated page)
      const center = map.getCenter()
      setStateBefore({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
        page: tweetPage,
      })

      selectTweet(tweet.id)

      // Apply the view from the tweet's URL (layers, zoom, location)
      if (tweet.expandedUrl) {
        applyViewFromUrl(tweet.expandedUrl, true)
      } else {
        // Fallback: just fly to the tweet's coordinates
        map.flyTo([tweet.coordinates.lat, tweet.coordinates.lng], Math.max(map.getZoom(), 12), {
          duration: 1,
        })
      }
    },
    [map, setStateBefore, selectTweet, applyViewFromUrl, calculatePageForTweet]
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

        // Add event listener to popup button when popup opens
        // Use requestAnimationFrame to ensure DOM is ready
        marker.on('popupopen', () => {
          requestAnimationFrame(() => {
            const popup = marker.getPopup()
            if (popup) {
              const popupElement = popup.getElement()
              if (popupElement) {
                const button = popupElement.querySelector('.tweet-activate-btn') as HTMLElement
                if (button) {
                  button.onclick = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleTweetActivation(tweet)
                  }
                }
              }
            }
          })
        })

        marker.on('click', () => handleMarkerClick(tweet))

        layerGroupRef.current.addLayer(marker)
        currentMarkers.set(tweet.id, marker)
      }
    }
  }, [map, tweetsToShow, isTweetsVisible, createPopupContent, handleMarkerClick, handleTweetActivation])

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
