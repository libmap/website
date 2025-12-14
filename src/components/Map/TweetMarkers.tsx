import { useEffect, useRef, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory, getHeadTweetById } from '@/utils/stories'
import type { Tweet } from '@/types'

// Helper function to format date as YYYY-MM-DD HH:MM
function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// Helper function to get display text for source
function getSourceDisplayText(source?: string): string {
  if (!source) return ''

  switch (source.toLowerCase()) {
    case 'twitter':
    case 'x':
      return '𝕏/Twitter'
    case 'mastodon.social':
      return 'Mastodon'
    case 'bluesky':
      return 'Bluesky'
    default:
      return source
  }
}

// Helper function to get CSS class for source badge
function getSourceBadgeClass(source?: string): string {
  if (!source) return 'tweet-source'

  // Convert source to CSS-safe class name by replacing dots and slashes
  const safeSource = source.replace(/[.\s/]/g, '-').toLowerCase()
  return `tweet-source source-${safeSource}`
}

// Marker colors based on tweet type
const MARKER_COLORS: Record<string, string> = {
  pollution: '#ef4444', // red
  climateaction: '#22c55e', // green
  transition: '#3b82f6', // blue
}

function createMarkerElement(type: Tweet['type']): HTMLElement {
  const color = MARKER_COLORS[type] ?? MARKER_COLORS.climateaction

  const el = document.createElement('div')
  el.className = 'tweet-marker'
  el.innerHTML = `
    <div class="tweet-marker-pin" style="background-color: ${color}">
      <div class="tweet-marker-inner"></div>
    </div>
  `
  return el
}

export function TweetMarkers() {
  const map = useStore((state) => state.map.instance)
  const visibleLayers = useStore((state) => state.layers.visible)
  const selectTweet = useStore((state) => state.selectTweet)
  const scrollToTweet = useStore((state) => state.scrollToTweet)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const pagination = useStore((state) => state.tweets.pagination)
  const allTweetsMap = useStore((state) => state.tweets.data)

  const { tweets: allTweets, visibleTweets, isLoading, updateVisibleTweets } = useTweets()
  const { applyViewFromUrl } = useUrlState()

  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const popupsRef = useRef<Map<string, maplibregl.Popup>>(new Map())

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
    const avatarUrl =
      tweet.authorAvatar && tweet.authorAvatar !== '' ? tweet.authorAvatar : '/avatar_icon.png'

    const hashtagsHtml =
      tweet.hashtags && tweet.hashtags.length > 0
        ? `<div class="tweet-hashtags">${tweet.hashtags.map((tag) => `<span class="hashtag">#${tag}</span>`).join('')}</div>`
        : ''

    return `
      <div class="tweet-popup">
        <div class="tweet-popup-header">
          <img
            src="${avatarUrl}"
            alt="${tweet.author}"
            class="tweet-avatar"
            onerror="this.onerror=null; this.src='/avatar_icon.png';"
          />
          <div class="tweet-author-info">
            <strong>${tweet.author}</strong>
            <span class="tweet-handle">@${tweet.authorHandle}</span>
          </div>
        </div>
        ${hashtagsHtml}
        <div class="tweet-popup-footer">
          <time>${formatDateTime(tweet.createdAt)}</time>
          ${tweet.source ? `<span class="${getSourceBadgeClass(tweet.source)}">${getSourceDisplayText(tweet.source)}</span>` : ''}
        </div>
        <button class="tweet-activate-btn" data-tweet-id="${tweet.id}">🔍 View Details</button>
      </div>
    `
  }, [])

  // Handle marker click - only scroll to tweet in sidebar, no activation
  const handleMarkerClick = useCallback(
    (tweet: Tweet) => {
      // Calculate which page this tweet should be on
      const tweetPage = calculatePageForTweet(tweet.id)

      // Navigate to the correct page if needed
      if (tweetPage !== pagination.currentPage) {
        const setPage = useStore.getState().setPage
        setPage(tweetPage)
      }

      // Scroll to the tweet in the sidebar without activating it
      // Use a small delay to allow page change to render
      setTimeout(() => {
        scrollToTweet(tweet.id)
      }, 100)
    },
    [scrollToTweet, calculatePageForTweet, pagination.currentPage]
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
        map.flyTo({
          center: [tweet.coordinates.lng, tweet.coordinates.lat],
          zoom: Math.max(map.getZoom(), 12),
          duration: 1000,
        })
      }
    },
    [map, setStateBefore, selectTweet, applyViewFromUrl, calculatePageForTweet]
  )

  // Create/update markers when tweets change
  useEffect(() => {
    if (!map || !isTweetsVisible) return

    const currentMarkers = markersRef.current
    const currentPopups = popupsRef.current
    const tweetIds = new Set(tweetsToShow.map((t) => t.id))

    // Remove markers for tweets that no longer exist or are filtered out
    for (const [id, marker] of currentMarkers.entries()) {
      if (!tweetIds.has(id)) {
        marker.remove()
        currentMarkers.delete(id)
        currentPopups.get(id)?.remove()
        currentPopups.delete(id)
      }
    }

    // Add/update markers for each tweet to show
    for (const tweet of tweetsToShow) {
      if (currentMarkers.has(tweet.id)) {
        // Update existing marker position if needed
        const marker = currentMarkers.get(tweet.id)!
        const pos = marker.getLngLat()
        if (pos.lat !== tweet.coordinates.lat || pos.lng !== tweet.coordinates.lng) {
          marker.setLngLat([tweet.coordinates.lng, tweet.coordinates.lat])
        }
      } else {
        // Create new marker
        const el = createMarkerElement(tweet.type)

        const popup = new maplibregl.Popup({
          offset: 20,
          maxWidth: '250px',
          className: 'tweet-popup-container',
        }).setHTML(createPopupContent(tweet))

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([tweet.coordinates.lng, tweet.coordinates.lat])
          .setPopup(popup)
          .addTo(map)

        // Handle marker click
        el.addEventListener('click', () => handleMarkerClick(tweet))

        // Add event listener to popup button when popup opens
        popup.on('open', () => {
          requestAnimationFrame(() => {
            const popupEl = popup.getElement()
            if (popupEl) {
              const button = popupEl.querySelector('.tweet-activate-btn') as HTMLElement
              if (button) {
                button.onclick = (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleTweetActivation(tweet)
                }
              }
            }
          })
        })

        currentMarkers.set(tweet.id, marker)
        currentPopups.set(tweet.id, popup)
      }
    }
  }, [
    map,
    tweetsToShow,
    isTweetsVisible,
    createPopupContent,
    handleMarkerClick,
    handleTweetActivation,
  ])

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

  // Show/hide markers based on visibility
  useEffect(() => {
    for (const marker of markersRef.current.values()) {
      const el = marker.getElement()
      el.style.display = isTweetsVisible ? '' : 'none'
    }
  }, [isTweetsVisible])

  // Highlight active tweet marker
  useEffect(() => {
    if (!activeTweetId) return

    const marker = markersRef.current.get(activeTweetId)
    if (marker) {
      marker.togglePopup()
    }
  }, [activeTweetId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.remove()
      }
      markersRef.current.clear()
      popupsRef.current.clear()
    }
  }, [])

  if (isLoading) {
    return null
  }

  return null
}
