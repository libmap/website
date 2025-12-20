import type { Tweet } from '@/types'

interface TeaserCardProps {
  tweet: Tweet
  hasStory: boolean
  onClick: () => void
  onHover?: () => void
  isActive?: boolean
  isHover?: boolean
  isSelected?: boolean
}

function getSourceIcon(source?: string): string {
  if (!source) return ''

  switch (source.toLowerCase()) {
    case 'twitter':
    case 'x':
      return '𝕏'
    case 'mastodon.social':
      return '🐘'
    case 'bluesky':
      return '🦋'
    default:
      return ''
  }
}

function truncateText(text: string, maxLength: number): string {
  // Strip HTML tags for Mastodon content
  const plainText = text.replace(/<[^>]*>/g, '')
  if (plainText.length <= maxLength) return plainText
  return plainText.slice(0, maxLength).trim() + '...'
}

export function TeaserCard({ tweet, hasStory, onClick, onHover, isActive, isHover, isSelected }: TeaserCardProps) {
  const sourceIcon = getSourceIcon(tweet.source)
  const teaserText = truncateText(tweet.text, 50)

  return (
    <div
      className={`teaser-card ${isActive ? 'active' : ''} ${isHover ? 'hover' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseEnter={onHover}

      onTouchStart={onHover}
      onFocus={onHover}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="teaser-content">
        <span className="teaser-handle">@{tweet.authorHandle}</span>
        <span className="teaser-text">{teaserText}</span>
      </div>
      <div className="teaser-badges">
        {hasStory && <span className="story-badge" title="Story thread">📖</span>}
        {sourceIcon && <span className="source-icon">{sourceIcon}</span>}
      </div>
    </div>
  )
}
