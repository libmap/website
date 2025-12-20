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

  // Format the date (e.g., "2023-01-15" -> "Jan 15, 2023")
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  const formattedDate = formatDate(tweet.createdAt)

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
        <div className="teaser-author-info">
          <span className="teaser-handle">@{tweet.authorHandle}</span>
          {formattedDate && <span className="teaser-date">{formattedDate}</span>}
          {hasStory && <span className="story-badge" title="Story thread">📖</span>}
        </div>
        <span className="teaser-text">{teaserText}</span>
      </div>
      <div className="teaser-badges">
        {sourceIcon && <span className="source-icon">{sourceIcon}</span>}
      </div>
    </div>
  )
}
