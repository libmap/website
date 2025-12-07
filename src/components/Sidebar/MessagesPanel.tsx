import { useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory, getHeadTweetById } from '@/utils/stories'
import type { Tweet } from '@/types'

// Helper component to render message text (handles HTML for Mastodon)
function MessageText({ tweet, truncate = false }: { tweet: Tweet; truncate?: boolean }) {
  const isMastodon = tweet.source === 'mastodon.social'
  let text = tweet.text

  // Truncate if needed (only in list view)
  if (truncate && text.length > 200) {
    text = text.slice(0, 200) + '...'
  }

  // For Mastodon, render HTML (it's already sanitized by the backend)
  if (isMastodon) {
    return <p className="message-text" dangerouslySetInnerHTML={{ __html: text }} />
  }

  // For other sources, render plain text
  return <p className="message-text">{text}</p>
}

export function MessagesPanel() {
  const { visibleTweets, isLoading, tweets } = useTweets()
  const { applyViewFromUrl } = useUrlState()
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const scrollToTweetId = useStore((state) => state.tweets.scrollToTweetId)
  const selectTweet = useStore((state) => state.selectTweet)
  const scrollToTweet = useStore((state) => state.scrollToTweet)
  const filters = useStore((state) => state.tweets.filters)
  const setFilter = useStore((state) => state.setFilter)
  const pagination = useStore((state) => state.tweets.pagination)
  const setPage = useStore((state) => state.setPage)
  const map = useStore((state) => state.map.instance)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const stateBefore = useStore((state) => state.stateBefore)
  const allTweetsMap = useStore((state) => state.tweets.data)

  // Refs for message cards to enable scrolling
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map())
  const messagesListRef = useRef<HTMLDivElement>(null)

  // Track which tweet should be highlighted (for marker clicks)
  const [highlightedTweetId, setHighlightedTweetId] = useState<string | null>(null)

  // Determine if we're in single story view or list view
  const isStoryView = activeTweetId !== null

  // Get the story to display if in story view
  const storyToDisplay = useMemo(() => {
    if (!isStoryView || !activeTweetId) return null

    // Get the head tweet for this story
    const headTweetId = getHeadTweetById(activeTweetId, allTweetsMap)
    if (!headTweetId) return null

    const headTweet = allTweetsMap.get(headTweetId)
    if (!headTweet) return null

    // Get all story tweets
    const storyTweets = getTweetsOfStory(tweets, headTweetId)

    return {
      headTweet,
      storyTweets,
    }
  }, [isStoryView, activeTweetId, allTweetsMap, tweets])

  // Paginate visible tweets (only used in list view)
  const paginatedTweets = useMemo(() => {
    if (isStoryView) return []
    const start = (pagination.currentPage - 1) * pagination.perPage
    const end = start + pagination.perPage
    return visibleTweets.slice(start, end)
  }, [isStoryView, visibleTweets, pagination.currentPage, pagination.perPage])

  const totalPages = Math.ceil(visibleTweets.length / pagination.perPage)

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

  // Scroll to active message when it changes
  useEffect(() => {
    if (!activeTweetId) return

    const messageElement = messageRefs.current.get(activeTweetId)
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [activeTweetId])

  // Scroll to tweet without activating it (for marker clicks)
  useEffect(() => {
    if (!scrollToTweetId) return

    const messageElement = messageRefs.current.get(scrollToTweetId)
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })

      // Highlight the message briefly
      setHighlightedTweetId(scrollToTweetId)

      // Remove highlight after animation completes (1.5 seconds)
      setTimeout(() => {
        setHighlightedTweetId(null)
      }, 1500)
    }

    // Clear the scroll target after scrolling
    scrollToTweet(null)
  }, [scrollToTweetId, scrollToTweet])

  // Calculate and save page when tweet is activated from external link
  useEffect(() => {
    // Only run when a tweet is activated and we don't have a saved page yet
    if (!activeTweetId || !map) return
    if (stateBefore && stateBefore.page !== undefined) return

    // Calculate which page this tweet should be on
    const tweetPage = calculatePageForTweet(activeTweetId)

    // Save the state with the calculated page
    const center = map.getCenter()
    setStateBefore({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
      page: tweetPage,
    })
  }, [activeTweetId, map, stateBefore, calculatePageForTweet, setStateBefore])

  // Scroll to top when pagination changes
  useEffect(() => {
    if (messagesListRef.current && !isStoryView) {
      // Find the scrollable parent (sidebar-content)
      const scrollableParent = messagesListRef.current.closest('.sidebar-content')
      if (scrollableParent) {
        scrollableParent.scrollTop = 0
      }
    }
  }, [pagination.currentPage, isStoryView])

  const handleTweetClick = (tweetId: string) => {
    if (!map) return

    // Find the tweet in the full tweets map (works for both head tweets and story tweets)
    const tweet = allTweetsMap.get(tweetId)
    if (!tweet) return

    // Calculate which page this tweet should be on
    const tweetPage = calculatePageForTweet(tweetId)

    // Save current state for back navigation (including calculated page)
    const center = map.getCenter()
    setStateBefore({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
      page: tweetPage,
    })

    selectTweet(tweetId)

    // Apply the view from the tweet's URL (layers, zoom, location)
    if (tweet.expandedUrl) {
      applyViewFromUrl(tweet.expandedUrl, true)
    } else {
      // Fallback: just fly to the tweet's coordinates
      map.flyTo([tweet.coordinates.lat, tweet.coordinates.lng], Math.max(map.getZoom(), 12), {
        duration: 1,
      })
    }
  }

  const handleClearFilter = (type: 'account' | 'hashtag') => {
    setFilter(type, null)
  }

  const handleBack = () => {
    const previousTweetId = activeTweetId

    // Clear active tweet
    selectTweet(null)

    // Restore previous map state and page if available
    if (stateBefore && map) {
      // Restore the page number if saved
      if (stateBefore.page && stateBefore.page !== pagination.currentPage) {
        setPage(stateBefore.page)
      }

      // Restore map state
      map.setView([stateBefore.center.lat, stateBefore.center.lng], stateBefore.zoom, {
        animate: true,
        duration: 0.5,
      })

      setStateBefore(null)

      // Scroll to the head tweet after a brief delay to allow page change to render
      if (previousTweetId) {
        setTimeout(() => {
          const headTweetId = getHeadTweetById(previousTweetId, allTweetsMap)
          if (headTweetId) {
            const messageElement = messageRefs.current.get(headTweetId)
            if (messageElement) {
              messageElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          }
        }, 100)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="messages-panel">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-panel">
      {/* Back Button (only in story view) */}
      {isStoryView && (
        <button type="button" className="back-button" onClick={handleBack}>
          ← Back to list
        </button>
      )}

      {/* Active Filters (only in list view) */}
      {!isStoryView && (filters.account || filters.hashtag) && (
        <div className="filters-section">
          {filters.account && (
            <span className="filter-chip">
              @{filters.account}
              <button type="button" onClick={() => handleClearFilter('account')}>
                ×
              </button>
            </span>
          )}
          {filters.hashtag && (
            <span className="filter-chip">
              #{filters.hashtag}
              <button type="button" onClick={() => handleClearFilter('hashtag')}>
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Message count (only in list view) */}
      {!isStoryView && (
        <div className="messages-count">
          {visibleTweets.length} message{visibleTweets.length !== 1 ? 's' : ''} in view
        </div>
      )}

      {/* Messages List */}
      <div ref={messagesListRef} className="messages-list">
        {isStoryView && storyToDisplay ? (
          /* Single Story View */
          <div className="story-container">
            {/* Head Tweet */}
            <article
              ref={(el) => {
                if (el) {
                  messageRefs.current.set(storyToDisplay.headTweet.id, el)
                } else {
                  messageRefs.current.delete(storyToDisplay.headTweet.id)
                }
              }}
              className={`message-card story-head ${activeTweetId === storyToDisplay.headTweet.id ? 'active' : ''} ${highlightedTweetId === storyToDisplay.headTweet.id ? 'highlight-blink' : ''}`}
              onClick={() => handleTweetClick(storyToDisplay.headTweet.id)}
            >
              <header className="message-header">
                <span className="author">{storyToDisplay.headTweet.author}</span>
                <span className="handle">@{storyToDisplay.headTweet.authorHandle}</span>
              </header>
              <MessageText tweet={storyToDisplay.headTweet} />
              <footer className="message-footer">
                <time>{new Date(storyToDisplay.headTweet.createdAt).toLocaleDateString()}</time>
                {storyToDisplay.headTweet.source && (
                  <span className="source-badge">{storyToDisplay.headTweet.source}</span>
                )}
              </footer>
            </article>

            {/* Story Tweets (indented) */}
            {storyToDisplay.storyTweets.map((storyTweet) => (
              <article
                key={storyTweet.id}
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(storyTweet.id, el)
                  } else {
                    messageRefs.current.delete(storyTweet.id)
                  }
                }}
                className={`message-card story-indent ${activeTweetId === storyTweet.id ? 'active' : ''} ${highlightedTweetId === storyTweet.id ? 'highlight-blink' : ''}`}
                onClick={() => handleTweetClick(storyTweet.id)}
              >
                <header className="message-header">
                  <span className="author">{storyTweet.author}</span>
                  <span className="handle">@{storyTweet.authorHandle}</span>
                </header>
                <MessageText tweet={storyTweet} />
                <footer className="message-footer">
                  <time>{new Date(storyTweet.createdAt).toLocaleDateString()}</time>
                  {storyTweet.source && (
                    <span className="source-badge">{storyTweet.source}</span>
                  )}
                </footer>
              </article>
            ))}
          </div>
        ) : paginatedTweets.length === 0 ? (
          /* Empty state */
          <div className="empty-state">
            <p>No messages in this area</p>
            <p className="hint">Pan or zoom the map to find messages</p>
          </div>
        ) : (
          /* List View */
          paginatedTweets.map((headTweet) => {
            // Get story tweets for this head tweet
            const storyTweets = getTweetsOfStory(tweets, headTweet.id)

            return (
              <div key={headTweet.id} className="story-container">
                {/* Head Tweet */}
                <article
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(headTweet.id, el)
                    } else {
                      messageRefs.current.delete(headTweet.id)
                    }
                  }}
                  className={`message-card story-head ${activeTweetId === headTweet.id ? 'active' : ''} ${highlightedTweetId === headTweet.id ? 'highlight-blink' : ''}`}
                  onClick={() => handleTweetClick(headTweet.id)}
                >
                  <header className="message-header">
                    <span className="author">{headTweet.author}</span>
                    <span className="handle">@{headTweet.authorHandle}</span>
                  </header>
                  <MessageText tweet={headTweet} truncate={false} />
                  <footer className="message-footer">
                    <time>{new Date(headTweet.createdAt).toLocaleDateString()}</time>
                    {headTweet.source && (
                      <span className="source-badge">{headTweet.source}</span>
                    )}
                  </footer>
                </article>

                {/* Story Tweets (indented) */}
                {storyTweets.map((storyTweet) => (
                  <article
                    key={storyTweet.id}
                    ref={(el) => {
                      if (el) {
                        messageRefs.current.set(storyTweet.id, el)
                      } else {
                        messageRefs.current.delete(storyTweet.id)
                      }
                    }}
                    className={`message-card story-indent ${activeTweetId === storyTweet.id ? 'active' : ''} ${highlightedTweetId === storyTweet.id ? 'highlight-blink' : ''}`}
                    onClick={() => handleTweetClick(storyTweet.id)}
                  >
                    <header className="message-header">
                      <span className="author">{storyTweet.author}</span>
                      <span className="handle">@{storyTweet.authorHandle}</span>
                    </header>
                    <MessageText tweet={storyTweet} truncate={false} />
                    <footer className="message-footer">
                      <time>{new Date(storyTweet.createdAt).toLocaleDateString()}</time>
                      {storyTweet.source && (
                        <span className="source-badge">{storyTweet.source}</span>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {!isStoryView && totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            disabled={pagination.currentPage === 1}
            onClick={() => setPage(pagination.currentPage - 1)}
            className="pagination-btn"
          >
            ← Prev
          </button>
          <span className="pagination-info">
            {pagination.currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={pagination.currentPage === totalPages}
            onClick={() => setPage(pagination.currentPage + 1)}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
