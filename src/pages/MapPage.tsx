import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer } from '@/components/Map/MapContainer'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { useUrlState } from '@/hooks/useUrlState'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useStore } from '@/store'

export function MapPage() {
  const { account, hashtag } = useParams<{ account?: string; hashtag?: string }>()
  const { initFromUrl } = useUrlState()
  const isInitialized = useStore((state) => state.isInitialized)
  const setIsMobile = useStore((state) => state.setIsMobile)
  const setIsPreview = useStore((state) => state.setIsPreview)
  const isMobile = useIsMobile()

  // For URL-based tweet activation
  const urlToTweetId = useStore((state) => state.tweets.urlToTweetId)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const selectTweet = useStore((state) => state.selectTweet)
  const urlCheckDone = useRef(false)

  // Initialize from URL on mount
  useEffect(() => {
    const urlState = initFromUrl()
    // Ensure preview mode is off for MapPage
    setIsPreview(false)
  }, [initFromUrl, setIsPreview])

  // Check URL against tweet URLs after tweets load (legacy URL-based activation)
  useEffect(() => {
    // Only run once, after tweets are loaded, and if no tweet is already active
    if (urlToTweetId.size > 0 && !activeTweetId && !urlCheckDone.current) {
      urlCheckDone.current = true

      // Decode URL to handle %2C -> , etc.
      const currentPath = decodeURIComponent(window.location.pathname + window.location.search)
      const matchedTweetId = urlToTweetId.get(currentPath)

      if (matchedTweetId) {
        selectTweet(matchedTweetId)
      }
    }
  }, [urlToTweetId.size, activeTweetId, selectTweet])

  // Sync mobile state
  useEffect(() => {
    setIsMobile(isMobile)
  }, [isMobile, setIsMobile])

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading map...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <MapContainer />
      <Sidebar />
    </div>
  )
}
