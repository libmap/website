import { useRef, useCallback, useState, useEffect, type ReactNode } from 'react'
import { useStore } from '@/store'

interface BottomSheetProps {
  children: ReactNode
}

export function BottomSheet({ children }: BottomSheetProps) {
  const height = useStore((state) => state.ui.bottomSheetHeight)
  const setHeight = useStore((state) => state.setBottomSheetHeight)
  const viewMode = useStore((state) => state.tweets.viewMode)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // State for overscroll-to-drag functionality
  const [isOverscrolling, setIsOverscrolling] = useState(false)

  // Refs for overscroll-to-drag functionality
  const contentRef = useRef<HTMLDivElement>(null)
  const overscrollStartY = useRef(0)
  const overscrollStartHeight = useRef(0)

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true
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
      const newHeight = Math.min(90, Math.max(10, startHeight.current + deltaPercent))
      setHeight(newHeight)
    },
    [setHeight]
  )

  const handleDragEnd = useCallback(() => {
    isDragging.current = false

    // Snap to preset heights
    if (height < 20) {
      setHeight(10) // Minimized
    } else if (height < 40) {
      setHeight(30) // Small
    } else if (height < 60) {
      setHeight(50) // Medium
    } else {
      setHeight(70) // Expanded
    }
  }, [height, setHeight])

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
        const newHeight = Math.min(90, Math.max(10, overscrollStartHeight.current - deltaPercent))
        setHeight(newHeight)
      }
    },
    [setHeight]
  )

  const handleContentTouchEnd = useCallback(() => {
    if (isOverscrolling) {
      // Snap to preset heights (same logic as handleDragEnd)
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
    }
  }, [height, setHeight, isOverscrolling, setIsOverscrolling])

  // Auto-expand to minimum 50% when entering story mode
  useEffect(() => {
    if (viewMode === 'story' && height < 50) {
      setHeight(50)
    }
  }, [viewMode, height, setHeight])

  const isMinimized = height <= 10

  return (
    <div
      className={`bottom-sheet ${isMinimized ? 'minimized' : ''}`}
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
