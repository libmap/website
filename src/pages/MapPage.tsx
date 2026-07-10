import { useEffect, useRef } from 'react'
import { MapContainer } from '@/components/Map/MapContainer'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { WelcomeDialog } from '@/components/Map/WelcomeDialog'
import { useUrlState } from '@/hooks/useUrlState'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useStore } from '@/store'
import { getHeadTweetById, getTweetsOfStory } from '@/utils/stories'

export function MapPage() {
  const { initFromUrl } = useUrlState()
  const isInitialized = useStore((state) => state.isInitialized)
  const setIsMobile = useStore((state) => state.setIsMobile)
  const setIsPreview = useStore((state) => state.setIsPreview)
  const isMobile = useIsMobile()

  // For URL-based tweet activation
  const urlToTweetId = useStore((state) => state.tweets.urlToTweetId)
  const tweetsData = useStore((state) => state.tweets.data)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const enterStoryView = useStore((state) => state.enterStoryView)
  const setStoryIndex = useStore((state) => state.setStoryIndex)
  const urlCheckDone = useRef(false)

  // Initialize from URL on mount
  useEffect(() => {
    initFromUrl()
    // Ensure preview mode is off for MapPage
    setIsPreview(false)
  }, [initFromUrl, setIsPreview])

  // Check URL against tweet URLs after tweets load - auto enter story view
  useEffect(() => {
    // Only run once, after tweets are loaded, and if no tweet is already active
    if (urlToTweetId.size > 0 && tweetsData.size > 0 && !activeTweetId && !urlCheckDone.current) {
      urlCheckDone.current = true

      // Decode URL to handle %2C -> , etc.
      const currentPath = decodeURIComponent(window.location.pathname + window.location.search)
      const matchedTweetId = urlToTweetId.get(currentPath)

      if (matchedTweetId) {
        // Find the head tweet for this story
        const headTweetId = getHeadTweetById(matchedTweetId, tweetsData)

        if (headTweetId) {
          // Enter story view (this sets index to 0)
          enterStoryView(matchedTweetId)

          // If the matched tweet is not the head tweet, find its index in the story
          if (matchedTweetId !== headTweetId) {
            const allTweets = Array.from(tweetsData.values())
            const storyTweets = getTweetsOfStory(allTweets, headTweetId)
            const headTweet = tweetsData.get(headTweetId)

            // Build the full story array: [headTweet, ...storyTweets]
            const allStoryItems = headTweet ? [headTweet, ...storyTweets] : storyTweets

            // Find the index of the matched tweet
            const matchedIndex = allStoryItems.findIndex(t => t.id === matchedTweetId)
            if (matchedIndex > 0) {
              setStoryIndex(matchedIndex)
            }
          }
        } else {
          // No head tweet found, just enter story view normally
          enterStoryView(matchedTweetId)
        }
      }
    }
  }, [urlToTweetId, tweetsData, activeTweetId, enterStoryView, setStoryIndex])

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
    <>
      <div className="app">
        <MapContainer />
        <Sidebar />
      </div>
      <WelcomeDialog />
    </>
  )
}
