import { useRef, useCallback, type ReactNode } from 'react'
import { useStore } from '@/store'

interface BottomSheetProps {
  children: ReactNode
}

export function BottomSheet({ children }: BottomSheetProps) {
  const height = useStore((state) => state.ui.bottomSheetHeight)
  const setHeight = useStore((state) => state.setBottomSheetHeight)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

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
    } else if (height < 50) {
      setHeight(30) // Default
    } else {
      setHeight(70) // Expanded
    }
  }, [height, setHeight])

  return (
    <div
      className="bottom-sheet"
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
      <div className="bottom-sheet-content">{children}</div>
    </div>
  )
}
