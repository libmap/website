export interface TweetCoordinates {
  lat: number
  lng: number
}

export interface Tweet {
  id: string
  tweetId: string
  text: string
  author: string
  authorHandle: string
  authorAvatar?: string | undefined
  createdAt: string
  coordinates: TweetCoordinates
  type: 'pollution' | 'climateaction' | 'transition'
  replyToTweetId?: string | undefined
  expandedUrl?: string | undefined
  media?: TweetMedia[] | undefined
  hashtags?: string[] | undefined
  isStoryRoot?: boolean | undefined
}

export interface TweetMedia {
  type: 'photo' | 'video'
  url: string
  thumbnailUrl?: string
}

export interface Story {
  id: string
  rootTweetId: string
  tweets: Tweet[]
  title?: string
}

export interface TweetFilters {
  account: string | null
  hashtag: string | null
}

export interface TweetsState {
  data: Map<string, Tweet>
  visibleIds: string[]
  activeTweetId: string | null
  activeStoryId: string | null
  filters: TweetFilters
  pagination: {
    currentPage: number
    perPage: number
  }
}
