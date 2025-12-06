import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useStore } from '@/store'
import { api } from '@/services/api'
import type { Tweet } from '@/types'
import { extractHeadTweets } from '@/utils/stories'

export function useTweets() {
  const setTweets = useStore((state) => state.setTweets)
  const setVisibleTweetIds = useStore((state) => state.setVisibleTweetIds)
  const tweets = useStore((state) => state.tweets.data)
  const visibleIds = useStore((state) => state.tweets.visibleIds)
  const filters = useStore((state) => state.tweets.filters)
  const filterByBounds = useStore((state) => state.tweets.filterByBounds)
  const frozenBounds = useStore((state) => state.tweets.frozenBounds)

  const query = useQuery({
    queryKey: ['tweets'],
    queryFn: async () => {
      const data = await api.getTweets()
      setTweets(data)
      return data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  })

  // Filter tweets based on current bounds and filters
  const getVisibleTweets = useCallback((): Tweet[] => {
    let result = Array.from(tweets.values())

    // Filter by bounds only if filterByBounds is enabled
    // Use frozenBounds (captured when button clicked) instead of current bounds
    if (filterByBounds && frozenBounds) {
      result = result.filter((tweet) => {
        const { lat, lng } = tweet.coordinates
        return frozenBounds.contains([lat, lng])
      })

      // Find story tweets in bounds and include their head tweets
      // even if the head tweet is outside the bounds
      const storyTweetsInBounds = result.filter((t) => t.story && t.story !== t.id)
      const headTweetIdsNeeded = new Set(storyTweetsInBounds.map((t) => t.story!))

      // Add head tweets that weren't in bounds but have story tweets that are
      headTweetIdsNeeded.forEach((headTweetId) => {
        if (!result.some((t) => t.id === headTweetId)) {
          const headTweet = tweets.get(headTweetId)
          if (headTweet) {
            result.push(headTweet)
          }
        }
      })
    }

    // Filter by account
    if (filters.account) {
      const account = filters.account.toLowerCase()
      result = result.filter(
        (tweet) =>
          tweet.authorHandle.toLowerCase().includes(account) ||
          tweet.author.toLowerCase().includes(account)
      )
    }

    // Filter by hashtag
    if (filters.hashtag) {
      const hashtag = filters.hashtag.toLowerCase()
      result = result.filter(
        (tweet) =>
          tweet.hashtags?.some((h) => h.toLowerCase().includes(hashtag)) ||
          tweet.text.toLowerCase().includes(`#${hashtag}`)
      )
    }

    // Extract only head tweets for display (story tweets will be shown under their head tweets)
    return extractHeadTweets(result)
  }, [tweets, frozenBounds, filters, filterByBounds])

  // Update visible tweet IDs when bounds/filters change
  const updateVisibleTweets = useCallback(() => {
    const visible = getVisibleTweets()
    setVisibleTweetIds(visible.map((t) => t.id))
  }, [getVisibleTweets, setVisibleTweetIds])

  // Auto-update visible tweets when dependencies change
  useEffect(() => {
    // Don't update if we don't have tweets yet
    if (tweets.size === 0) return

    // Call update whenever filtering criteria changes
    updateVisibleTweets()
  }, [tweets, frozenBounds, filterByBounds, filters, updateVisibleTweets])

  return {
    tweets: Array.from(tweets.values()),
    visibleTweets: visibleIds.map((id) => tweets.get(id)).filter((t): t is Tweet => t !== undefined),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateVisibleTweets,
    getVisibleTweets,
  }
}
