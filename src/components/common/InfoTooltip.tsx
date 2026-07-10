import { useEffect, useRef, useState } from 'react'

// Info icon with tooltip for displaying source citations
export function InfoTooltip({ citation, iconSize = 14 }: { citation: string; iconSize?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  // Close on tap/click outside (mouseleave only covers devices with hover)
  useEffect(() => {
    if (!isVisible) return

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsVisible(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isVisible])

  return (
    <span
      ref={rootRef}
      className="layer-info-icon"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => {
        // preventDefault keeps a click inside the surrounding <label> from toggling its input
        e.preventDefault()
        e.stopPropagation()
        setIsVisible(!isVisible)
      }}
      role="button"
      aria-label={citation}
    >
      <svg viewBox="0 0 16 16" width={iconSize} height={iconSize} fill="currentColor">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.93 12.28h-1.9V6.6h1.9v5.68zm-.95-6.82a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z" />
      </svg>
      {isVisible && <span className="layer-info-tooltip">{citation}</span>}
    </span>
  )
}
