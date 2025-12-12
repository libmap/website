import type { Tweet, TweetMedia } from '@/types'

interface MessageTextProps {
  tweet: Tweet
  truncate?: boolean
}

// Helper component to render message text (handles HTML for Mastodon)
export function MessageText({ tweet, truncate = false }: MessageTextProps) {
  const isMastodon = tweet.source === 'mastodon.social'
  let text = tweet.text

  // Truncate if needed (only in list view)
  if (truncate && text.length > 200) {
    text = text.slice(0, 200) + '...'
  }

  // For Mastodon, render HTML (it's already sanitized by the backend)
  if (isMastodon) {
    return <p className="message-text" dangerouslySetInnerHTML={{ __html: text }} />
  }

  // For other sources, render plain text
  return <p className="message-text">{text}</p>
}

interface MessageHashtagsProps {
  tweet: Tweet
}

// Helper component to render hashtags
export function MessageHashtags({ tweet }: MessageHashtagsProps) {
  if (!tweet.hashtags || tweet.hashtags.length === 0) return null

  return (
    <div className="message-hashtags">
      {tweet.hashtags.map((hashtag, index) => (
        <span key={index} className="hashtag">
          #{hashtag}
        </span>
      ))}
    </div>
  )
}

interface MessageMediaProps {
  tweet: Tweet
  onImageClick: (media: TweetMedia[], index: number) => void
}

// Helper component to render media attachments
export function MessageMedia({ tweet, onImageClick }: MessageMediaProps) {
  if (!tweet.media || tweet.media.length === 0) return null

  return (
    <div className="message-media">
      {tweet.media.map((media, index) => {
        // Check if media URL exists and is not empty
        const mediaUrl = media.thumbnailUrl || media.url
        if (!mediaUrl || mediaUrl.trim() === '') return null

        return (
          <div key={index} className="media-item">
            {media.type === 'photo' && (
              <img
                src={mediaUrl}
                alt="Tweet media"
                className="media-thumbnail"
                onClick={() => onImageClick(tweet.media!, index)}
                onLoad={(e) => {
                  // Check if the loaded image is actually valid (not an error response)
                  const img = e.currentTarget
                  // Only show the image if it's reasonably sized (not an error XML response)
                  if (img.naturalWidth >= 10 && img.naturalHeight >= 10) {
                    img.style.display = 'block'
                  } else {
                    img.style.display = 'none'
                  }
                }}
                onError={(e) => {
                  // Hide the image if it fails to load
                  e.currentTarget.style.display = 'none'
                }}
                style={{ cursor: 'pointer', display: 'none' }}
              />
            )}
            {media.type === 'video' && (
              <div className="video-placeholder" onClick={() => onImageClick(tweet.media!, index)}>
                <span>🎥 Video</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
