import type { TweetMedia } from '@/types'

interface MediaViewerProps {
  media: TweetMedia[] | null
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
}

export function MediaViewer({
  media,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: MediaViewerProps) {
  if (!isOpen || !media || media.length === 0 || currentIndex >= media.length) return null

  const currentMedia = media[currentIndex]
  if (!currentMedia) return null

  const hasMultiple = media.length > 1

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1
    onNavigate(newIndex)
  }

  const goToNext = () => {
    const newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0
    onNavigate(newIndex)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrevious()
    } else if (e.key === 'ArrowRight') {
      goToNext()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="media-viewer-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="media-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="media-viewer-close" onClick={onClose}>
          ×
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              className="media-viewer-nav media-viewer-prev"
              onClick={goToPrevious}
            >
              ‹
            </button>
            <button type="button" className="media-viewer-nav media-viewer-next" onClick={goToNext}>
              ›
            </button>
          </>
        )}

        {currentMedia.type === 'photo' && (
          <img
            src={currentMedia.url}
            alt="Full size media"
            className="media-viewer-image"
            onClick={hasMultiple ? goToNext : undefined}
            style={{ cursor: hasMultiple ? 'pointer' : 'default' }}
          />
        )}

        {currentMedia.type === 'video' && (
          <div
            className="media-viewer-video-placeholder"
            onClick={hasMultiple ? goToNext : undefined}
            style={{ cursor: hasMultiple ? 'pointer' : 'default' }}
          >
            <span>🎥 Video</span>
            <p>This video cannot be displayed inline</p>
            <a href={currentMedia.url} target="_blank" rel="noopener noreferrer">
              Open in new tab
            </a>
          </div>
        )}

        {hasMultiple && (
          <div className="media-viewer-counter">
            {currentIndex + 1} / {media.length}
          </div>
        )}
      </div>
    </div>
  )
}
