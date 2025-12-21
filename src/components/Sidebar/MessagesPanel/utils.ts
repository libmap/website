// Helper function to format date nicely (e.g., "Jan 15, 2023")
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

// Helper function to get display text for source
export function getSourceDisplayText(source?: string): string {
  if (!source) return ''

  switch (source.toLowerCase()) {
    case 'twitter':
    case 'x':
      return '𝕏/Twitter'
    case 'mastodon.social':
      return 'Mastodon'
    case 'bluesky':
      return 'Bluesky'
    default:
      return source
  }
}

// Helper function to get CSS class for source badge
export function getSourceBadgeClass(source?: string): string {
  if (!source) return 'source-badge'

  // Convert source to CSS-safe class name by replacing dots and slashes
  const safeSource = source.replace(/[.\s/]/g, '-').toLowerCase()
  return `source-badge source-${safeSource}`
}
