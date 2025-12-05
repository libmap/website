import { useMemo } from 'react'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'

export function MessagesPanel() {
  const { visibleTweets, isLoading } = useTweets()
  const { applyViewFromUrl } = useUrlState()
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const selectTweet = useStore((state) => state.selectTweet)
  const filters = useStore((state) => state.tweets.filters)
  const setFilter = useStore((state) => state.setFilter)
  const pagination = useStore((state) => state.tweets.pagination)
  const setPage = useStore((state) => state.setPage)
  const map = useStore((state) => state.map.instance)
  const setStateBefore = useStore((state) => state.setStateBefore)

  // Paginate visible tweets
  const paginatedTweets = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.perPage
    const end = start + pagination.perPage
    return visibleTweets.slice(start, end)
  }, [visibleTweets, pagination.currentPage, pagination.perPage])

  const totalPages = Math.ceil(visibleTweets.length / pagination.perPage)

  const handleTweetClick = (tweetId: string) => {
    const tweet = visibleTweets.find((t) => t.id === tweetId)
    if (!tweet || !map) return

    // Save current state for back navigation
    const center = map.getCenter()
    setStateBefore({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
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
      {/* Active Filters */}
      {(filters.account || filters.hashtag) && (
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

      {/* Message count */}
      <div className="messages-count">
        {visibleTweets.length} message{visibleTweets.length !== 1 ? 's' : ''} in view
      </div>

      {/* Messages List */}
      <div className="messages-list">
        {paginatedTweets.length === 0 ? (
          <div className="empty-state">
            <p>No messages in this area</p>
            <p className="hint">Pan or zoom the map to find messages</p>
          </div>
        ) : (
          paginatedTweets.map((tweet) => (
            <article
              key={tweet.id}
              className={`message-card ${activeTweetId === tweet.id ? 'active' : ''}`}
              onClick={() => handleTweetClick(tweet.id)}
            >
              <header className="message-header">
                <span className="author">{tweet.author}</span>
                <span className="handle">@{tweet.authorHandle}</span>
              </header>
              <p className="message-text">
                {tweet.text.length > 200 ? tweet.text.slice(0, 200) + '...' : tweet.text}
              </p>
              <footer className="message-footer">
                <time>{new Date(tweet.createdAt).toLocaleDateString()}</time>
                <span className={`type-badge ${tweet.type}`}>{tweet.type}</span>
              </footer>
            </article>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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
