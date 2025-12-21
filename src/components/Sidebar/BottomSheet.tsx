import { useRef, useCallback, useState, useEffect, type ReactNode } from 'react'
import { useStore } from '@/store'

interface BottomSheetProps {
  children: ReactNode
}

export function BottomSheet({ children }: BottomSheetProps) {
  const height = useStore((state) => state.ui.bottomSheetHeight)
  const setHeight = useStore((state) => state.setBottomSheetHeight)
  const viewMode = useStore((state) => state.tweets.viewMode)
  const currentStoryIndex = useStore((state) => state.tweets.currentStoryIndex)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // State for overscroll-to-drag functionality
  const [isOverscrolling, setIsOverscrolling] = useState(false)

  // Track if currently dragging (for disabling transitions)
  const [isDraggingState, setIsDraggingState] = useState(false)

  // Content height for story mode
  const [contentHeight, setContentHeight] = useState<number | null>(null)

  // Refs for overscroll-to-drag functionality
  const contentRef = useRef<HTMLDivElement>(null)
  const overscrollStartY = useRef(0)
  const overscrollStartHeight = useRef(0)

  const isStoryMode = viewMode === 'story'

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

  // Overscroll-to-drag handlers
  const handleContentTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const content = contentRef.current
      if (!content || !e.touches[0]) return

      // Check if at top of scroll OR if content is not scrollable (short content)
      const isAtTop = content.scrollTop === 0
      const isContentShort = content.scrollHeight <= content.clientHeight

      if (isAtTop || isContentShort) {
        // Prevent pull-to-refresh by stopping event propagation and preventing default
        e.preventDefault()
        e.stopPropagation()

        overscrollStartY.current = e.touches[0].clientY
        overscrollStartHeight.current = height
        setIsOverscrolling(false)
        setIsDraggingState(true)
      }
    },
    [height]
  )

  const handleContentTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const content = contentRef.current
      const touch = e.touches[0]
      if (!content || !touch) return

      const isAtTop = content.scrollTop === 0
      const isContentShort = content.scrollHeight <= content.clientHeight
      const deltaY = touch.clientY - overscrollStartY.current

      // Only handle if at top OR content is short, and scrolling up (positive deltaY means swiping down)
      if ((isAtTop || isContentShort) && deltaY > 0) {
        // Prevent default scroll and pull-to-refresh
        e.preventDefault()
        setIsOverscrolling(true)

        // Convert touch delta to vh percentage (same as drag handle logic)
        const deltaPercent = (deltaY / window.innerHeight) * 100
        const newHeight = Math.min(maxHeight, Math.max(10, overscrollStartHeight.current - deltaPercent))
        setHeight(newHeight)
      }
    },
    [setHeight, maxHeight]
  )

  const handleContentTouchEnd = useCallback(() => {
    // First re-enable transitions
    setIsDraggingState(false)

    if (isOverscrolling) {
      // Use requestAnimationFrame to ensure transition is enabled before snap
      requestAnimationFrame(() => {
        if (isStoryMode) {
          // In story mode, snap to content height or minimized
          if (height < 20) {
            setHeight(10)
          } else {
            setHeight(maxHeight)
          }
        } else {
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
        }

        setIsOverscrolling(false)
      })
    }
  }, [height, setHeight, isOverscrolling, isStoryMode, maxHeight])

  // Measure content height in story mode
  useEffect(() => {
    if (!isStoryMode) {
      setContentHeight(null)
      return
    }

    const measureContent = () => {
      const content = contentRef.current
      if (!content) return

      // Find the message card and measure its actual height
      const messageCard = content.querySelector('.message-card') as HTMLElement
      if (messageCard) {
        // Use scrollHeight to get the full content height even if constrained
        const cardHeight = Math.max(messageCard.scrollHeight, messageCard.offsetHeight)
        // Add padding for drag handle (~40px) and sidebar-content padding
        const totalHeight = cardHeight + 60
        const heightInVh = (totalHeight / window.innerHeight) * 100
        const newHeight = Math.min(90, Math.max(20, heightInVh))

        // Only update if height changed significantly (avoid micro-adjustments)
        setContentHeight(prev => {
          if (prev === null || Math.abs(prev - newHeight) > 1) {
            return newHeight
          }
          return prev
        })
      }
    }

    // Measure after content renders
    const timeoutId = setTimeout(measureContent, 50)

    // Also observe for size changes (e.g., images loading)
    const resizeObserver = new ResizeObserver(() => {
      measureContent()
    })

    const content = contentRef.current
    if (content) {
      // Observe the message card for size changes
      const messageCard = content.querySelector('.message-card')
      if (messageCard) {
        resizeObserver.observe(messageCard)
      }

      // Watch for image loads
      const images = content.querySelectorAll('img')
      images.forEach(img => {
        if (!img.complete) {
          img.addEventListener('load', measureContent)
        }
      })
    }

    window.addEventListener('resize', measureContent)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measureContent)

      // Clean up image listeners
      const content = contentRef.current
      if (content) {
        const images = content.querySelectorAll('img')
        images.forEach(img => {
          img.removeEventListener('load', measureContent)
        })
      }
    }
  }, [isStoryMode, currentStoryIndex])

  // Handle view mode transitions
  const prevViewModeRef = useRef(viewMode)
  useEffect(() => {
    if (isStoryMode && prevViewModeRef.current !== 'story') {
      // Entering story mode: expand to allow content to render at full size for measurement
      setHeight(90)
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

  const isMinimized = height <= 10

  return (
    <div
      className={`bottom-sheet ${isMinimized ? 'minimized' : ''} ${isStoryMode ? 'story-mode' : ''} ${isDraggingState ? 'dragging' : ''}`}
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
