// Helper function to format date as YYYY-MM-DD HH:MM
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
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
