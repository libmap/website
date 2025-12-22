import { useMemo, useEffect, useState, useRef } from 'react'
import { useStore } from '@/store'
import { useTweets } from '@/hooks/useTweets'
import { useUrlState } from '@/hooks/useUrlState'
import { getTweetsOfStory, getHeadTweetById } from '@/utils/stories'
import { formatDateTime, getSourceDisplayText, getSourceBadgeClass } from './utils'
import { MessageText, MessageHashtags, MessageMedia } from './MessageCard'
import { MediaViewer } from './MediaViewer'
import type { TweetMedia } from '@/types'

export function StoryViewer() {
  const { tweets: allTweets } = useTweets()
  const { applyViewFromUrl } = useUrlState()
  const allTweetsMap = useStore((state) => state.tweets.data)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const currentStoryIndex = useStore((state) => state.tweets.currentStoryIndex)
  const setStoryIndex = useStore((state) => state.setStoryIndex)
  const exitStoryView = useStore((state) => state.exitStoryView)
  const selectTweet = useStore((state) => state.selectTweet)
  const map = useStore((state) => state.map.instance)
  const stateBefore = useStore((state) => state.stateBefore)
  const setStateBefore = useStore((state) => state.setStateBefore)
  const closeAllPopups = useStore((state) => state.closeAllPopups)

  // Media viewer state
  const [viewerMedia, setViewerMedia] = useState<TweetMedia[] | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track the last applied story index to prevent duplicate flyTo calls
  const lastAppliedIndexRef = useRef<number | null>(null)
  // Track the story we're viewing to reset index tracking when story changes
  const lastStoryIdRef = useRef<string | null>(null)

  // Get the story to display
  const storyData = useMemo(() => {
    if (!activeTweetId) return null

    // Get the head tweet for this story
    const headTweetId = getHeadTweetById(activeTweetId, allTweetsMap)
    if (!headTweetId) return null

    const headTweet = allTweetsMap.get(headTweetId)
    if (!headTweet) return null

    // Get all story tweets (replies)
    const storyTweets = getTweetsOfStory(allTweets, headTweetId)

    // Combine head tweet + story tweets in order
    const allStoryItems = [headTweet, ...storyTweets]

    return {
      headTweet,
      allItems: allStoryItems,
      totalCount: allStoryItems.length,
    }
  }, [activeTweetId, allTweetsMap, allTweets])

  // Get the current item to display
  const currentItem = useMemo(() => {
    if (!storyData) return null
    const index = Math.min(currentStoryIndex, storyData.allItems.length - 1)
    return storyData.allItems[index]
  }, [storyData, currentStoryIndex])

  // Reset index tracking when a new story is opened
  useEffect(() => {
    const headTweetId = storyData?.headTweet?.id
    if (headTweetId && headTweetId !== lastStoryIdRef.current) {
      lastStoryIdRef.current = headTweetId
      lastAppliedIndexRef.current = null
    }
  }, [storyData?.headTweet?.id])

  // Fly to current item location when navigating within story (not on initial load)
  useEffect(() => {
    if (!currentItem || !map) return

    // Skip if this is the same index we already applied (prevents infinite loops)
    if (lastAppliedIndexRef.current === currentStoryIndex) return

    // Skip initial render - the marker click already handled the initial flyTo
    if (lastAppliedIndexRef.current === null) {
      lastAppliedIndexRef.current = currentStoryIndex
      return
    }

    // Update the ref before applying view
    lastAppliedIndexRef.current = currentStoryIndex

    if (currentItem.expandedUrl) {
      applyViewFromUrl(currentItem.expandedUrl, true)
    } else {
      map.flyTo({
        center: [currentItem.coordinates.lng, currentItem.coordinates.lat],
        zoom: Math.max(map.getZoom(), 12),
        duration: 1000,
      })
    }
  }, [currentStoryIndex, currentItem, map, applyViewFromUrl])

  // Update active tweet ID when navigating
  useEffect(() => {
    if (currentItem && currentItem.id !== activeTweetId) {
      selectTweet(currentItem.id)
    }
  }, [currentItem, activeTweetId, selectTweet])

  const handleBack = () => {
    // Close any open popups
    setIsViewerOpen(false)
    setViewerMedia(null)
    setViewerIndex(0)
    closeAllPopups()

    // Exit story view
    exitStoryView()

    // Restore previous map state if available
    if (stateBefore && map) {
      map.flyTo({
        center: [stateBefore.center.lng, stateBefore.center.lat],
        zoom: stateBefore.zoom,
        duration: 500,
      })
      setStateBefore(null)
    }
  }

  const handlePrev = () => {
    if (currentStoryIndex > 0) {
      setStoryIndex(currentStoryIndex - 1)
    }
  }

  const handleNext = () => {
    if (storyData && currentStoryIndex < storyData.totalCount - 1) {
      setStoryIndex(currentStoryIndex + 1)
    }
  }

  // Touch handlers for swipe navigation (horizontal only)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartX.current = e.touches[0].clientX
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !e.changedTouches[0]) return

    const touchEndX = e.changedTouches[0].clientX
    const deltaX = touchEndX - touchStartX.current
    const threshold = 50 // Minimum swipe distance

    // Swipe right - go back to overview
    if (deltaX > threshold) {
      handleBack()
    }

    touchStartX.current = null
  }

  if (!storyData || !currentItem) {
    return (
      <div className="story-viewer">
        <div className="story-viewer-empty">
          <button type="button" className="back-link-standalone" onClick={handleBack}>
            ← Back to overview
          </button>
          <p>Message not found</p>
        </div>
      </div>
    )
  }

  const hasMultipleItems = storyData.totalCount > 1
  const canGoPrev = currentStoryIndex > 0
  const canGoNext = currentStoryIndex < storyData.totalCount - 1

  return (
    <div className="story-viewer">
      {/* Message card */}
      <div
        ref={containerRef}
        className="story-content"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <article className={`message-card story-focus ${hasMultipleItems ? 'has-nav' : ''}`}>
          {/* Story navigation arrows - inside card */}
          {hasMultipleItems && (
            <div className="story-nav-arrows">
              <button
                type="button"
                className="nav-arrow nav-prev"
                onClick={handlePrev}
                disabled={!canGoPrev}
                aria-label="Previous message"
              >
                ↑
              </button>
              <span className="story-position">
                {currentStoryIndex + 1}/{storyData.totalCount}
              </span>
              <button
                type="button"
                className="nav-arrow nav-next"
                onClick={handleNext}
                disabled={!canGoNext}
                aria-label="Next message"
              >
                ↓
              </button>
            </div>
          )}
          <header className="message-header">
            <button type="button" className="back-link" onClick={handleBack} aria-label="Back to overview">
              ←
            </button>
            <img
              src={currentItem.authorAvatar || '/avatar_icon.png'}
              alt=""
              className="author-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = '/avatar_icon.png'
              }}
            />
            <div className="author-info">
              <span className="author">{currentItem.author}</span>
              <span className="handle">@{currentItem.authorHandle}</span>
            </div>
          </header>
          <MessageText tweet={currentItem} />
          <MessageHashtags tweet={currentItem} />
          <MessageMedia
            tweet={currentItem}
            onImageClick={(media, index) => {
              setViewerMedia(media)
              setViewerIndex(index)
              setIsViewerOpen(true)
            }}
          />
          <footer className="message-footer">
            <time>{formatDateTime(currentItem.createdAt)}</time>
            {currentItem.source && (
              <span className={getSourceBadgeClass(currentItem.source)}>
                {getSourceDisplayText(currentItem.source)}
              </span>
            )}
          </footer>
        </article>
      </div>

      {/* Media Viewer */}
      <MediaViewer
        media={viewerMedia}
        currentIndex={viewerIndex}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false)
          setViewerMedia(null)
          setViewerIndex(0)
        }}
        onNavigate={(index) => setViewerIndex(index)}
      />
    </div>
  )
}
