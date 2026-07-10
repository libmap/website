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
  el.style.cursor = 'pointer' // Change cursor to pointer on hover
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
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const allTweetsMap = useStore((state) => state.tweets.data)
  const closePopups = useStore((state) => state.ui.closePopups)
  const viewMode = useStore((state) => state.tweets.viewMode)
  const enterStoryView = useStore((state) => state.enterStoryView)
  const overviewPage = useStore((state) => state.tweets.overviewPage)

  const { tweets: allTweets, visibleTweets, isLoading, updateVisibleTweets } = useTweets()
  const { applyViewFromUrl } = useUrlState()

  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const popupsRef = useRef<Map<string, maplibregl.Popup>>(new Map())

  const isTweetsVisible = visibleLayers.includes('tweets')

  // Filter tweets to show based on viewMode
  const ITEMS_PER_PAGE = 10
  const tweetsToShow = useMemo(() => {
    // In story mode, only show the active tweet's marker
    if (viewMode === 'story' && activeTweetId) {
      const activeTweet = allTweetsMap.get(activeTweetId)
      return activeTweet ? [activeTweet] : []
    }

    // In overview mode, show head tweets for the current page
    const start = (overviewPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    const headTweetsToShow = visibleTweets.slice(start, end)

    // Also include all story tweets for these head tweets (for map marker display)
    const allTweetsToShow: Tweet[] = []

    headTweetsToShow.forEach((headTweet) => {
      // Add the head tweet
      allTweetsToShow.push(headTweet)

      // Add all story tweets for this head tweet
      const storyTweets = getTweetsOfStory(allTweets, headTweet.id)
      allTweetsToShow.push(...storyTweets)
    })

    return allTweetsToShow
  }, [viewMode, activeTweetId, allTweetsMap, visibleTweets, allTweets, overviewPage])

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

  const setVisibleLayers = useStore((state) => state.setVisibleLayers)
  const hoverTweet = useStore((state) => state.hoverTweet)
  const selectTweetForHighlight = useStore((state) => state.selectTweetForHighlight)



  // Handle marker click - focus map and open popup (like hover behavior)
  const handleMarkerClick = useCallback(
    (tweet: Tweet, marker?: maplibregl.Marker) => {
      console.log(`Marker clicked for tweet ${tweet.id}`)
      if (!map) {
        console.log('No map instance available')
        return
      }

      // Set layers to satellite and tweets (like hover behavior)
      setVisibleLayers(['satellite', 'tweets'])

      // Pan to tweet location with overview zoom (like hover behavior)
      map.flyTo({
        center: [tweet.coordinates.lng, tweet.coordinates.lat],
        zoom: 3,
        duration: 1000,
      })

      // Close any other open popups first
      console.log(`Closing other popups, total popups: ${popupsRef.current.size}`)
      for (const [id, otherPopup] of popupsRef.current.entries()) {
        if (id !== tweet.id && otherPopup.isOpen()) {
          console.log(`Closing popup for tweet ${id}`)
          otherPopup.remove()
        }
      }
      
      // Set selection for this tweet after closing other popups
      const tweetIdToHighlight = getHeadTweetById(tweet.id, allTweetsMap) || tweet.id
      selectTweetForHighlight(tweetIdToHighlight)
      
      // Let Maplibre handle the popup opening automatically
      // The popup should open when the marker element is clicked
      // If it doesn't, we'll try to manually open it as a fallback
      setTimeout(() => {
        const targetMarker = marker || markersRef.current.get(tweet.id)
        console.log(`Target marker found: ${!!targetMarker}`)
        if (targetMarker) {
          const popup = targetMarker.getPopup()
          console.log(`Popup found: ${!!popup}`)
          if (popup && !popup.isOpen()) {
            console.log(`Manually opening popup for tweet ${tweet.id}`)
            popup.setLngLat([tweet.coordinates.lng, tweet.coordinates.lat])
            popup.addTo(map)
            
            // Check if the popup was actually added
            setTimeout(() => {
              console.log(`Popup is open: ${popup.isOpen()}`)
              if (popup.isOpen()) {
                console.log('Popup successfully opened')
                const popupElement = popup.getElement()
                console.log(`Popup element: ${popupElement}`)
                if (popupElement) {
                  console.log(`Popup element style: ${popupElement.style.display}`)
                  console.log(`Popup element content: ${popupElement.innerHTML}`)
                }
              } else {
                console.log('Popup failed to open')
              }
            }, 100)
          }
        }
      }, 200)
    },
    [map, setVisibleLayers, popupsRef, selectTweetForHighlight, allTweetsMap]
  )

  // Handle full activation from popup button
  const handleTweetActivation = useCallback(
    (tweet: Tweet) => {
      if (!map) return

      // Save current state for back navigation
      const center = map.getCenter()
      setStateBefore({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      })

      // Enter story view for this tweet
      enterStoryView(tweet.id)

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
    [map, setStateBefore, enterStoryView, applyViewFromUrl]
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

        // Handle marker hover - highlight corresponding teaser card
        // For story tweets, highlight the head tweet; for regular tweets, highlight the tweet itself
        el.addEventListener('mouseenter', () => {
          const tweetIdToHighlight = getHeadTweetById(tweet.id, allTweetsMap) || tweet.id
          hoverTweet(tweetIdToHighlight)
        })
        
        el.addEventListener('mouseleave', () => {
          hoverTweet(null)
        })
        
        // Handle marker click - focus map, open popup, and set persistent highlight
        el.addEventListener('click', () => {
          handleMarkerClick(tweet, marker)
        })

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
        
        // Clear selection when this popup closes
        popup.on('close', () => {
          // Use a small delay to allow any new selection to be set first
          // (in case we're clicking a new marker)
          setTimeout(() => {
            // Only clear if no other popups are open
            let anyPopupOpen = false
            for (const [id, otherPopup] of popupsRef.current.entries()) {
              if (id !== tweet.id && otherPopup.isOpen()) {
                anyPopupOpen = true
                break
              }
            }
            
            if (!anyPopupOpen) {
              selectTweetForHighlight(null)
            }
          }, 100)
        })

        currentMarkers.set(tweet.id, marker)
        currentPopups.set(tweet.id, popup)
        
        // Debug: log that marker and popup were created
        console.log(`Created marker and popup for tweet ${tweet.id}`)
      }
    }
  }, [
    map,
    tweetsToShow,
    isTweetsVisible,
    createPopupContent,
    handleMarkerClick,
    handleTweetActivation,
    hoverTweet,
    selectTweetForHighlight,
    allTweetsMap,
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
    // Close any open popups first
    for (const popup of popupsRef.current.values()) {
      popup.remove()
    }

    // Open popup for active tweet if any
    if (activeTweetId) {
      const marker = markersRef.current.get(activeTweetId)
      if (marker && map) {
        marker.getPopup()?.addTo(map)
      }
    }
  }, [activeTweetId, map])



  // Close all popups when requested
  useEffect(() => {
    for (const popup of popupsRef.current.values()) {
      popup.remove()
    }
  }, [closePopups])

  // Cleanup on unmount
  useEffect(() => {
    const markers = markersRef.current
    const popups = popupsRef.current
    return () => {
      for (const marker of markers.values()) {
        marker.remove()
      }
      markers.clear()
      popups.clear()
    }
  }, [])

  if (isLoading) {
    return null
  }

  return null
}
