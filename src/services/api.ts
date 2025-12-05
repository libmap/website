import { getBackendConfig, type BackendConfig } from '@/config'
import type { Tweet } from '@/types'

// Actual API response format
interface RawPythonTweet {
  url: string // Contains lat/lng params
  hashtags?: string[]
  timestamp: string
  content: string
  account: string
  display_name: string
  avatar?: string
  media?: string[]
  source: string
}

interface RawJavaPOI {
  tweetId: string
  expandedUrl?: string
  type: string
  replyToTweetId?: string
  location: {
    lat: number
    lng: number
  }
}

interface JavaAPIResponse {
  _embedded: {
    poi: RawJavaPOI[]
  }
}

// Parse lat/lng from URL like "/map?ls=dark,tweets&z=4&lng=17.97&lat=22.39"
function parseCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  try {
    const urlObj = new URL(url, 'https://libmap.org')
    const lat = parseFloat(urlObj.searchParams.get('lat') || '')
    const lng = parseFloat(urlObj.searchParams.get('lng') || '')

    if (isNaN(lat) || isNaN(lng)) {
      return null
    }

    return { lat, lng }
  } catch {
    return null
  }
}

// Transform Python API response to Tweet type
function transformPythonTweet(id: string, raw: RawPythonTweet): Tweet | null {
  const coordinates = parseCoordinatesFromUrl(raw.url)
  if (!coordinates) {
    console.warn(`Failed to parse coordinates from URL: ${raw.url}`)
    return null
  }

  // Default avatar if none provided
  const avatar = raw.avatar || 'https://libmap.org/static/avatar_icon.png'

  // Transform media URLs to TweetMedia objects
  const media = raw.media?.map((url) => ({
    type: 'photo' as const,
    url,
  }))

  return {
    id,
    tweetId: id,
    text: raw.content,
    author: raw.display_name,
    authorHandle: raw.account,
    authorAvatar: avatar,
    createdAt: raw.timestamp,
    coordinates,
    type: 'climateaction', // Default type
    expandedUrl: raw.url,
    hashtags: raw.hashtags,
    media,
  }
}

// Transform Java API response to Tweet type
function transformJavaPOI(raw: RawJavaPOI): Tweet {
  return {
    id: raw.tweetId,
    tweetId: raw.tweetId,
    text: '', // Java API doesn't provide text - needs separate fetch
    author: '',
    authorHandle: '',
    createdAt: new Date().toISOString(),
    coordinates: { lat: raw.location.lat, lng: raw.location.lng },
    type: (raw.type as Tweet['type']) || 'climateaction',
    replyToTweetId: raw.replyToTweetId,
    expandedUrl: raw.expandedUrl,
  }
}

class APIService {
  private config: BackendConfig

  constructor(backendName?: string) {
    this.config = getBackendConfig(backendName)
  }

  async getTweets(): Promise<Tweet[]> {
    switch (this.config.format) {
      case 'python':
        return this.fetchPythonTweets()
      case 'java':
        return this.fetchJavaTweets()
      case 'file':
        return this.fetchFileTweets()
      default:
        throw new Error(`Unknown backend format: ${this.config.format}`)
    }
  }

  private async fetchPythonTweets(): Promise<Tweet[]> {
    if (!this.config.server) {
      throw new Error('Python backend requires server URL')
    }

    const response = await fetch(`${this.config.server}/tweets/`)
    if (!response.ok) {
      throw new Error(`Failed to fetch tweets: ${response.statusText}`)
    }

    const data = (await response.json()) as { date: number; tweets: Record<string, RawPythonTweet> }

    // Transform tweets object to array
    const tweets: Tweet[] = []
    for (const [id, rawTweet] of Object.entries(data.tweets)) {
      const tweet = transformPythonTweet(id, rawTweet)
      if (tweet) {
        tweets.push(tweet)
      }
    }

    return tweets
  }

  private async fetchJavaTweets(): Promise<Tweet[]> {
    if (!this.config.server) {
      throw new Error('Java backend requires server URL')
    }

    const response = await fetch(`${this.config.server}/poi?size=100`)
    if (!response.ok) {
      throw new Error(`Failed to fetch POIs: ${response.statusText}`)
    }

    const data = (await response.json()) as JavaAPIResponse
    return data._embedded.poi.map(transformJavaPOI)
  }

  private async fetchFileTweets(): Promise<Tweet[]> {
    // Static file fallback - in real implementation would import from JSON
    return []
  }

  // Fetch GeoJSON data
  async fetchGeoJSON<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON: ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
}

// Export singleton instance
export const api = new APIService()

// Export class for testing
export { APIService }
