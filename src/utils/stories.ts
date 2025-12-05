import type { Tweet } from '@/types'

/**
 * Extract head tweets from a list of tweets.
 * Head tweets are tweets that don't have a story field or have a story field equal to their own ID.
 */
export function extractHeadTweets(tweets: Tweet[]): Tweet[] {
  return tweets.filter((tweet) => !tweet.story || tweet.story === tweet.id)
}

/**
 * Get all story tweets for a given head tweet.
 * Story tweets are tweets that have a story field pointing to the head tweet but are not the head tweet themselves.
 */
export function getTweetsOfStory(tweets: Tweet[], storyId: string): Tweet[] {
  return tweets.filter((tweet) => tweet.story === storyId && tweet.story !== tweet.id)
}

/**
 * Get the head tweet ID for a given tweet ID.
 * If the tweet is already a head tweet, returns its own ID.
 * If it's a story tweet, returns the ID of its head tweet.
 */
export function getHeadTweetById(tweetId: string, tweets: Map<string, Tweet>): string | null {
  const tweet = tweets.get(tweetId)
  if (!tweet) return null

  // It's a head tweet (no story or story equals own ID)
  if (!tweet.story || tweet.story === tweetId) {
    return tweetId
  }

  // It's a story tweet - return the head tweet ID
  return tweet.story
}
