import { useMemo, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory } from '@/utils/stories'
import { TeaserCard } from './TeaserCard'
import { OverviewLayersPanel } from './OverviewLayersPanel'

const ITEMS_PER_PAGE = 10

export function OverviewBox() {
  const { visibleTweets, tweets: allTweets, isLoading } = useTweets()
  const { applyViewFromUrl } = useUrlState()
  const enterStoryView = useStore((state) => state.enterStoryView)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const hoverTweetId = useStore((state) => state.tweets.hoverTweetId)
  const selectedTweetId = useStore((state) => state.tweets.selectedTweetId)
  const selectTweetForHighlight = useStore((state) => state.selectTweetForHighlight)
  const hoverTweet = useStore((state) => state.hoverTweet)
  const allTweetsMap = useStore((state) => state.tweets.data)
  const map = useStore((state) => state.map.instance)
  const setStateBefore = useStore((state) => state.setStateBefore)

  // Pagination state from store
  const currentPage = useStore((state) => state.tweets.overviewPage)
  const setCurrentPage = useStore((state) => state.setOverviewPage)

  // Calculate total pages
  const totalPages = Math.ceil(visibleTweets.length / ITEMS_PER_PAGE)

  // Get paginated head tweets
  const headTweets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return visibleTweets.slice(start, end)
  }, [visibleTweets, currentPage])

  // Reset to page 1 when visible tweets change significantly
  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage, setCurrentPage])

  // Scroll to top when page changes
  useEffect(() => {
    // Scroll the overview list
    if (overviewListRef.current) {
      overviewListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }

    // Also scroll the bottom sheet content to top
    const bottomSheetContent = document.querySelector('.bottom-sheet-content')
    if (bottomSheetContent) {
      bottomSheetContent.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }, [currentPage])

  // Check if a head tweet has story replies
  const hasStoryReplies = (headTweetId: string): boolean => {
    const storyTweets = getTweetsOfStory(allTweets, headTweetId)
    return storyTweets.length > 0
  }

  const setVisibleLayers = useStore((state) => state.setVisibleLayers)
  const overviewMode = useStore((state) => state.ui.overviewMode)
  const setOverviewMode = useStore((state) => state.setOverviewMode)

  // Ref for the overview list container
  const overviewListRef = useRef<HTMLDivElement>(null)

  // Scroll to selected tweet when it changes
  useEffect(() => {
    if (selectedTweetId && overviewListRef.current) {
      const selectedElement = overviewListRef.current.querySelector(
        `[data-tweet-id="${selectedTweetId}"]`
      ) as HTMLElement

      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }
    }
  }, [selectedTweetId])

  const handleTeaserHover = useCallback(
    (tweetId: string) => {
      const tweet = allTweetsMap.get(tweetId)
      if (!tweet || !map) return

      // Set hover state for this tweet
      hoverTweet(tweetId)

      // Clear any existing selection when hovering over a different card
      if (selectedTweetId !== tweetId) {
        selectTweetForHighlight(null)
      }

      // Set layers to satellite and tweets
      setVisibleLayers(['satellite', 'tweets'])

      // Pan to tweet location with overview zoom
      map.flyTo({
        center: [tweet.coordinates.lng, tweet.coordinates.lat],
        zoom: 3,
        duration: 1000,
      })
    },
    [allTweetsMap, map, setVisibleLayers, selectedTweetId, selectTweetForHighlight, hoverTweet]
  )

  const handleTeaserClick = useCallback(
    (tweetId: string) => {
      const tweet = allTweetsMap.get(tweetId)
      if (!tweet || !map) return

      // Set selection for this tweet
      selectTweetForHighlight(tweetId)

      // Save current state for back navigation
      const center = map.getCenter()
      setStateBefore({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      })

      // Enter story view
      enterStoryView(tweetId)

      // Fly to the tweet's location
      if (tweet.expandedUrl) {
        applyViewFromUrl(tweet.expandedUrl, true)
      } else {
        map.flyTo({
          center: [tweet.coordinates.lng, tweet.coordinates.lat],
          zoom: Math.max(map.getZoom(), 12),
          duration: 1000,
        })
      }
    },
    [allTweetsMap, map, setStateBefore, enterStoryView, applyViewFromUrl, selectTweetForHighlight]
  )

  if (isLoading) {
    return (
      <div className="overview-box">
        <div className="overview-loading">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (headTweets.length === 0) {
    return (
      <div className="overview-box">
        <div className="overview-empty">
          <p>No messages in this area</p>
        </div>
      </div>
    )
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="overview-box">
      <div className="overview-header">
        <span className="overview-count">{visibleTweets.length} messages</span>
        <div className="overview-mode-toggle">
          <button
            type="button"
            className={`mode-button ${overviewMode === 'messages' ? 'active' : ''}`}
            onClick={() => setOverviewMode('messages')}
            title="Show messages"
            aria-label="Show messages"
          >
            📋
          </button>
          <button
            type="button"
            className={`mode-button ${overviewMode === 'layers' ? 'active' : ''}`}
            onClick={() => setOverviewMode('layers')}
            title="Show layers"
            aria-label="Show layers"
          >
            🗺️
          </button>
        </div>
      </div>
      <div className="overview-list" ref={overviewListRef}>
        {overviewMode === 'messages' ? (
          headTweets.map((tweet) => (
            <TeaserCard
              key={tweet.id}
              tweet={tweet}
              hasStory={hasStoryReplies(tweet.id)}
              onClick={() => handleTeaserClick(tweet.id)}
              onHover={() => handleTeaserHover(tweet.id)}
              isActive={activeTweetId === tweet.id}
              isHover={hoverTweetId === tweet.id}
              isSelected={selectedTweetId === tweet.id}
            />
          ))
        ) : (
          <OverviewLayersPanel />
        )}
      </div>
      {overviewMode === 'messages' && totalPages > 1 && (
        <div className="overview-pagination">
          <button
            type="button"
            className="overview-pagination-btn"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          <span className="overview-pagination-info">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="overview-pagination-btn"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
