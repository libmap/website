import { useMemo, useCallback, useEffect } from 'react'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory } from '@/utils/stories'
import { TeaserCard } from './TeaserCard'

const ITEMS_PER_PAGE = 10

export function OverviewBox() {
  const { visibleTweets, tweets: allTweets, isLoading } = useTweets()
  const { applyViewFromUrl } = useUrlState()
  const enterStoryView = useStore((state) => state.enterStoryView)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
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

  // Check if a head tweet has story replies
  const hasStoryReplies = (headTweetId: string): boolean => {
    const storyTweets = getTweetsOfStory(allTweets, headTweetId)
    return storyTweets.length > 0
  }

  const setVisibleLayers = useStore((state) => state.setVisibleLayers)

  const handleTeaserHover = useCallback((tweetId: string) => {
    const tweet = allTweetsMap.get(tweetId)
    if (!tweet || !map) return

    // Set layers to satellite and tweets
    setVisibleLayers(['satellite', 'tweets'])

    // Pan to tweet location with overview zoom
    map.flyTo({
      center: [tweet.coordinates.lng, tweet.coordinates.lat],
      zoom: 3,
      duration: 1000,
    })
  }, [allTweetsMap, map, setVisibleLayers])

  const handleTeaserClick = useCallback((tweetId: string) => {
    const tweet = allTweetsMap.get(tweetId)
    if (!tweet || !map) return

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
  }, [allTweetsMap, map, setStateBefore, enterStoryView, applyViewFromUrl])

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
      </div>
      <div className="overview-list">
        {headTweets.map((tweet) => (
          <TeaserCard
            key={tweet.id}
            tweet={tweet}
            hasStory={hasStoryReplies(tweet.id)}
            onClick={() => handleTeaserClick(tweet.id)}
            onHover={() => handleTeaserHover(tweet.id)}
            isActive={activeTweetId === tweet.id}
          />
        ))}
      </div>
      {totalPages > 1 && (
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
