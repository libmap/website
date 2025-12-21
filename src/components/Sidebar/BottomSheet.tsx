import { useRef, useCallback, useState, useEffect, type ReactNode } from 'react'
import { useStore } from '@/store'

interface BottomSheetProps {
  children: ReactNode
}

export function BottomSheet({ children }: BottomSheetProps) {
  const height = useStore((state) => state.ui.bottomSheetHeight)
  const setHeight = useStore((state) => state.setBottomSheetHeight)
  const contentHeight = useStore((state) => state.ui.storyContentHeight)
  const setContentHeight = useStore((state) => state.setStoryContentHeight)
  const viewMode = useStore((state) => state.tweets.viewMode)
  const currentStoryIndex = useStore((state) => state.tweets.currentStoryIndex)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // State for overscroll-to-drag functionality
  const [isOverscrolling, setIsOverscrolling] = useState(false)

  // Track if currently dragging (for disabling transitions)
  const [isDraggingState, setIsDraggingState] = useState(false)

  // Track which story index has been measured and is ready to show
  const [readyStoryIndex, setReadyStoryIndex] = useState<number | null>(null)

  // Refs for overscroll-to-drag functionality
  const contentRef = useRef<HTMLDivElement>(null)
  const overscrollStartY = useRef(0)
  const overscrollStartHeight = useRef(0)
  const heightRef = useRef(height)

  // Keep heightRef in sync
  useEffect(() => {
    heightRef.current = height
  }, [height])

  const isStoryMode = viewMode === 'story'
  const isMinimized = height <= 10
  const viewModeRef = useRef(viewMode)

  // Keep viewModeRef in sync
  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  // Calculate max height based on content in story mode
  const maxHeight = isStoryMode && contentHeight !== null
    ? Math.min(90, Math.max(10, contentHeight))
    : 90

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true
      setIsDraggingState(true)
      startY.current = e.clientY
      startHeight.current = height
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [height]
  )

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return

      const deltaY = startY.current - e.clientY
      const deltaPercent = (deltaY / window.innerHeight) * 100
      const newHeight = Math.min(maxHeight, Math.max(10, startHeight.current + deltaPercent))
      setHeight(newHeight)
    },
    [setHeight, maxHeight]
  )

  const handleDragEnd = useCallback(() => {
    isDragging.current = false

    // First re-enable transitions, then snap
    setIsDraggingState(false)

    // Use requestAnimationFrame to ensure transition is enabled before snap
    requestAnimationFrame(() => {
      if (isStoryMode) {
        // In story mode, snap to either content height or minimized
        if (height < 20) {
          setHeight(10)
        } else {
          setHeight(maxHeight)
        }
      } else {
        // In overview mode, snap to preset heights
        if (height < 20) {
          setHeight(10) // Minimized
        } else if (height < 40) {
          setHeight(30) // Small
        } else if (height < 60) {
          setHeight(50) // Medium
        } else {
          setHeight(70) // Expanded
        }
      }
    })
  }, [height, setHeight, isStoryMode, maxHeight])

  // Native touch handlers for story mode (to prevent pull-to-refresh)
  useEffect(() => {
    if (!isStoryMode) return

    const content = contentRef.current
    if (!content) return

    let startY = 0
    let startHeight = 0
    let isDraggingContent = false
    let wasOverscrolling = false

    const handleTouchStart = (e: TouchEvent) => {
      if (!e.touches[0]) return
      startY = e.touches[0].clientY
      startHeight = heightRef.current
      isDraggingContent = true
      wasOverscrolling = false
      setIsDraggingState(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingContent || !e.touches[0]) return

      const deltaY = e.touches[0].clientY - startY

      // Always prevent default in story mode to avoid pull-to-refresh
      e.preventDefault()
      wasOverscrolling = true
      setIsOverscrolling(true)

      const deltaPercent = (deltaY / window.innerHeight) * 100
      const currentMaxHeight = contentHeight !== null
        ? Math.min(90, Math.max(10, contentHeight))
        : 90
      // Positive deltaY = swipe down = reduce height
      // Negative deltaY = swipe up = increase height (but capped at maxHeight)
      const newHeight = Math.min(currentMaxHeight, Math.max(10, startHeight - deltaPercent))
      setHeight(newHeight)
    }

    const handleTouchEnd = () => {
      if (!isDraggingContent) return
      isDraggingContent = false
      setIsDraggingState(false)

      // Only snap if still in story mode (user might have swiped to go back)
      if (wasOverscrolling && viewModeRef.current === 'story') {
        requestAnimationFrame(() => {
          // Double-check we're still in story mode
          if (viewModeRef.current !== 'story') {
            setIsOverscrolling(false)
            return
          }
          const currentMaxHeight = contentHeight !== null
            ? Math.min(90, Math.max(10, contentHeight))
            : 90
          if (heightRef.current < 20) {
            setHeight(10)
          } else {
            setHeight(currentMaxHeight)
          }
          setIsOverscrolling(false)
        })
      } else {
        setIsOverscrolling(false)
      }
    }

    content.addEventListener('touchstart', handleTouchStart, { passive: true })
    content.addEventListener('touchmove', handleTouchMove, { passive: false })
    content.addEventListener('touchend', handleTouchEnd, { passive: true })
    content.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      content.removeEventListener('touchstart', handleTouchStart)
      content.removeEventListener('touchmove', handleTouchMove)
      content.removeEventListener('touchend', handleTouchEnd)
      content.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isStoryMode, contentHeight, setHeight])

  // Overscroll-to-drag handlers for overview mode
  const handleContentTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Skip in story mode - handled by native listeners
      if (isStoryMode) return

      const content = contentRef.current
      if (!content || !e.touches[0]) return

      // Check if at top of scroll OR if content is not scrollable (short content)
      const isAtTop = content.scrollTop === 0
      const isContentShort = content.scrollHeight <= content.clientHeight

      if (isAtTop || isContentShort) {
        overscrollStartY.current = e.touches[0].clientY
        overscrollStartHeight.current = height
        setIsOverscrolling(false)
        setIsDraggingState(true)
      }
    },
    [height, isStoryMode]
  )

  const handleContentTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // Skip in story mode - handled by native listeners
      if (isStoryMode) return

      const content = contentRef.current
      const touch = e.touches[0]
      if (!content || !touch) return

      const isAtTop = content.scrollTop === 0
      const isContentShort = content.scrollHeight <= content.clientHeight
      const deltaY = touch.clientY - overscrollStartY.current

      // Only handle if at top OR content is short, and scrolling up (positive deltaY means swiping down)
      if ((isAtTop || isContentShort) && deltaY > 0) {
        setIsOverscrolling(true)

        // Convert touch delta to vh percentage (same as drag handle logic)
        const deltaPercent = (deltaY / window.innerHeight) * 100
        const newHeight = Math.min(maxHeight, Math.max(10, overscrollStartHeight.current - deltaPercent))
        setHeight(newHeight)
      }
    },
    [setHeight, maxHeight, isStoryMode]
  )

  const handleContentTouchEnd = useCallback(() => {
    // Skip in story mode - handled by native listeners
    if (isStoryMode) return

    // First re-enable transitions
    setIsDraggingState(false)

    if (isOverscrolling) {
      // Use requestAnimationFrame to ensure transition is enabled before snap
      requestAnimationFrame(() => {
        // In overview mode, snap to preset heights
        if (height < 20) {
          setHeight(10)
        } else if (height < 40) {
          setHeight(30)
        } else if (height < 60) {
          setHeight(50)
        } else {
          setHeight(70)
        }

        setIsOverscrolling(false)
      })
    }
  }, [height, setHeight, isOverscrolling, isStoryMode])

  // Measure content height in story mode
  useEffect(() => {
    if (!isStoryMode) {
      setContentHeight(null)
      return
    }

    let readyTimer: ReturnType<typeof setTimeout> | null = null
    let hasSetFinalHeight = false
    let imagesReady = false
    let mapReady = false
    const trackedImages = new Set<HTMLImageElement>()

    // Set final height when both images AND map animation are done
    const trySetFinalHeight = () => {
      if (hasSetFinalHeight) return
      if (!imagesReady || !mapReady) return

      const content = contentRef.current
      if (!content) return

      const messageCard = content.querySelector('.message-card') as HTMLElement
      if (!messageCard) return

      hasSetFinalHeight = true

      const cardHeight = Math.max(messageCard.scrollHeight, messageCard.offsetHeight)
      const totalHeight = cardHeight + 60
      const heightInVh = (totalHeight / window.innerHeight) * 100
      const newHeight = Math.min(90, Math.max(20, heightInVh))

      setContentHeight(newHeight)

      // Mark ready after height transition
      if (readyTimer) clearTimeout(readyTimer)
      readyTimer = setTimeout(() => {
        setReadyStoryIndex(currentStoryIndex)
      }, 350)
    }

    // Check if all images are loaded
    const checkImagesReady = () => {
      const content = contentRef.current
      if (!content) return

      const messageCard = content.querySelector('.message-card') as HTMLElement
      if (!messageCard) return

      const images = content.querySelectorAll('img')
      const allImagesLoaded = Array.from(images).every(img => img.complete)

      if (allImagesLoaded) {
        imagesReady = true
        trySetFinalHeight()
      }
    }

    // Listen for map animation to finish
    const handleMapMoveEnd = () => {
      mapReady = true
      trySetFinalHeight()
    }

    // Check if map is currently moving
    const mapInstance = useStore.getState().map.instance
    if (mapInstance && mapInstance.isMoving()) {
      // Map is moving, wait for it to finish
      mapInstance.once('moveend', handleMapMoveEnd)
    } else {
      // Map is not moving, mark as ready
      mapReady = true
    }

    const setupImageListeners = () => {
      const content = contentRef.current
      if (!content) return

      const images = content.querySelectorAll('img')
      images.forEach(img => {
        if (!trackedImages.has(img)) {
          trackedImages.add(img)
          if (!img.complete) {
            img.addEventListener('load', checkImagesReady)
          }
        }
      })
    }

    // Wait for message-card to appear, then set up listeners
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let hasStartedWatching = false

    const startWatchingWhenReady = () => {
      const content = contentRef.current
      if (!content) return false

      const messageCard = content.querySelector('.message-card')
      if (!messageCard) return false

      if (hasStartedWatching) return true
      hasStartedWatching = true

      setupImageListeners()
      checkImagesReady()
      return true
    }

    // Poll for content to appear
    pollTimer = setInterval(() => {
      if (startWatchingWhenReady() && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }, 50)

    // Fallback: set height after max wait time
    const fallbackTimer = setTimeout(() => {
      if (!hasSetFinalHeight) {
        imagesReady = true
        mapReady = true
        trySetFinalHeight()
      }
    }, 3000) // Max 3 seconds wait

    // Watch for DOM changes (images being added)
    const mutationObserver = new MutationObserver(() => {
      if (!hasStartedWatching) {
        startWatchingWhenReady()
      } else {
        setupImageListeners()
        checkImagesReady()
      }
    })

    const content = contentRef.current
    if (content) {
      mutationObserver.observe(content, {
        childList: true,
        subtree: true,
      })
      setupImageListeners()
    }

    return () => {
      clearTimeout(fallbackTimer)
      if (readyTimer) clearTimeout(readyTimer)
      if (pollTimer) clearInterval(pollTimer)
      mutationObserver.disconnect()
      if (mapInstance) {
        mapInstance.off('moveend', handleMapMoveEnd)
      }

      trackedImages.forEach(img => {
        img.removeEventListener('load', checkImagesReady)
      })
    }
  }, [isStoryMode, currentStoryIndex, setContentHeight])

  // Handle view mode transitions
  const prevViewModeRef = useRef(viewMode)
  useEffect(() => {
    if (isStoryMode && prevViewModeRef.current !== 'story') {
      // Entering story mode: reset ready state, keep current height until images load
      setReadyStoryIndex(null)
    } else if (!isStoryMode && prevViewModeRef.current === 'story') {
      // Leaving story mode (back to overview): expand to 50%
      setHeight(50)
    }
    prevViewModeRef.current = viewMode
  }, [isStoryMode, viewMode, setHeight])

  // Set height to content height when it changes in story mode (but not while dragging)
  useEffect(() => {
    if (isStoryMode && contentHeight !== null && height > 10 && !isDraggingState) {
      setHeight(contentHeight)
    }
  }, [contentHeight, isStoryMode, setHeight, height, isDraggingState])

  // In story mode, only show content when current index matches ready index
  // In overview mode, always show content
  const isContentReady = !isStoryMode || readyStoryIndex === currentStoryIndex

  // Show loading indicator in story mode when content is not ready
  const showLoading = isStoryMode && !isContentReady && !isMinimized

  return (
    <div
      className={`bottom-sheet ${isMinimized ? 'minimized' : ''} ${isStoryMode ? 'story-mode' : ''} ${isDraggingState ? 'dragging' : ''} ${isContentReady ? 'content-ready' : ''}`}
      style={{ height: `${height}vh` }}
      role="complementary"
      aria-label="Messages and Layers panel"
    >
      <div
        className="drag-handle"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        role="slider"
        aria-label="Resize panel"
        aria-valuemin={10}
        aria-valuemax={90}
        aria-valuenow={height}
        tabIndex={0}
      >
        <div className="handle-bar" />
      </div>
      {showLoading && (
        <div className="bottom-sheet-loading">
          <div className="loading-spinner" />
        </div>
      )}
      {!isMinimized && (
        <div
          ref={contentRef}
          className={`bottom-sheet-content ${isOverscrolling ? 'overscrolling' : ''}`}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          onTouchCancel={handleContentTouchEnd}
        >
          {children}
        </div>
      )}
    </div>
  )
}
