import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { Map as MapLibreMap, LngLatBounds } from 'maplibre-gl'
import type { Coordinates, Tweet, TweetFilters, LayerSet, LayerInstance } from '@/types'

interface AppState {
  // Initialization
  isInitialized: boolean
  setInitialized: (value: boolean) => void

  // Map state
  map: {
    instance: MapLibreMap | null
    center: Coordinates
    zoom: number
    bounds: LngLatBounds | null
  }
  setMapInstance: (map: MapLibreMap | null) => void
  setMapView: (center: Coordinates, zoom: number) => void
  setMapBounds: (bounds: LngLatBounds) => void

  // Layer state
  layers: {
    visible: string[]
    baseLayer: string
    sets: LayerSet[]
    instances: Map<string, LayerInstance>
  }
  setVisibleLayers: (layers: string[]) => void
  toggleLayer: (layerId: string) => void
  setBaseLayer: (layerId: string) => void

  // Tweet state
  tweets: {
    data: Map<string, Tweet>
    urlToTweetId: Map<string, string> // URL → tweet ID mapping for URL-based activation
    visibleIds: string[]
    activeTweetId: string | null
    activeStoryId: string | null
    scrollToTweetId: string | null
    filters: TweetFilters
    filterByBounds: boolean
    frozenBounds: LngLatBounds | null
    pagination: {
      currentPage: number
      perPage: number
    }
  }
  setTweets: (tweets: Tweet[]) => void
  setVisibleTweetIds: (ids: string[]) => void
  selectTweet: (id: string | null) => void
  selectStory: (id: string | null) => void
  scrollToTweet: (id: string | null) => void
  setFilter: (type: keyof TweetFilters, value: string | null) => void
  setFilterByBounds: (value: boolean, frozenBounds?: LngLatBounds | null) => void
  setPage: (page: number) => void

  // UI state
  ui: {
    sidebarTab: 'messages' | 'layers'
    bottomSheetHeight: number // percentage of viewport height
    isMobile: boolean
    isPreview: boolean
  }
  setSidebarTab: (tab: 'messages' | 'layers') => void
  setBottomSheetHeight: (height: number) => void
  setIsMobile: (isMobile: boolean) => void
  setIsPreview: (isPreview: boolean) => void

  // State restoration (for back navigation)
  stateBefore: {
    center: Coordinates
    zoom: number
    page?: number
  } | null
  setStateBefore: (state: { center: Coordinates; zoom: number; page?: number } | null) => void
}

export const useStore = create<AppState>()(
  devtools(
    subscribeWithSelector((set) => ({
      // Initialization
      isInitialized: false,
      setInitialized: (value) => set({ isInitialized: value }),

      // Map state
      map: {
        instance: null,
        center: { lat: 48.2082, lng: 16.3738 }, // Vienna default
        zoom: 5,
        bounds: null,
      },
      setMapInstance: (instance) =>
        set((state) => ({
          map: { ...state.map, instance },
        })),
      setMapView: (center, zoom) =>
        set((state) => ({
          map: { ...state.map, center, zoom },
        })),
      setMapBounds: (bounds) =>
        set((state) => ({
          map: { ...state.map, bounds },
        })),

      // Layer state
      layers: {
        visible: ['satellite'],
        baseLayer: 'satellite',
        sets: [],
        instances: new Map(),
      },
      setVisibleLayers: (visible) =>
        set((state) => ({
          layers: { ...state.layers, visible },
        })),
      toggleLayer: (layerId) =>
        set((state) => {
          const visible = state.layers.visible.includes(layerId)
            ? state.layers.visible.filter((id) => id !== layerId)
            : [...state.layers.visible, layerId]
          return { layers: { ...state.layers, visible } }
        }),
      setBaseLayer: (layerId) =>
        set((state) => ({
          layers: { ...state.layers, baseLayer: layerId },
        })),

      // Tweet state
      tweets: {
        data: new Map(),
        urlToTweetId: new Map(),
        visibleIds: [],
        activeTweetId: null,
        activeStoryId: null,
        scrollToTweetId: null,
        filters: {
          account: null,
          hashtag: null,
        },
        filterByBounds: false,
        frozenBounds: null,
        pagination: {
          currentPage: 1,
          perPage: 10,
        },
      },
      setTweets: (tweets) =>
        set((state) => {
          const data = new Map(state.tweets.data)
          const urlToTweetId = new Map(state.tweets.urlToTweetId)
          tweets.forEach((tweet) => {
            data.set(tweet.id, tweet)
            // Build URL → tweet ID mapping for URL-based activation
            if (tweet.expandedUrl) {
              urlToTweetId.set(tweet.expandedUrl, tweet.id)
            }
          })
          return { tweets: { ...state.tweets, data, urlToTweetId } }
        }),
      setVisibleTweetIds: (visibleIds) =>
        set((state) => ({
          tweets: { ...state.tweets, visibleIds },
        })),
      selectTweet: (activeTweetId) =>
        set((state) => ({
          tweets: { ...state.tweets, activeTweetId },
        })),
      selectStory: (activeStoryId) =>
        set((state) => ({
          tweets: { ...state.tweets, activeStoryId },
        })),
      scrollToTweet: (scrollToTweetId) =>
        set((state) => ({
          tweets: { ...state.tweets, scrollToTweetId },
        })),
      setFilter: (type, value) =>
        set((state) => ({
          tweets: {
            ...state.tweets,
            filters: { ...state.tweets.filters, [type]: value },
            pagination: { ...state.tweets.pagination, currentPage: 1 },
          },
        })),
      setFilterByBounds: (filterByBounds, frozenBounds) =>
        set((state) => ({
          tweets: {
            ...state.tweets,
            filterByBounds,
            frozenBounds: frozenBounds !== undefined ? frozenBounds : state.tweets.frozenBounds,
            pagination: { ...state.tweets.pagination, currentPage: 1 },
          },
        })),
      setPage: (page) =>
        set((state) => ({
          tweets: {
            ...state.tweets,
            pagination: { ...state.tweets.pagination, currentPage: page },
          },
        })),

      // UI state
      ui: {
        sidebarTab: 'messages',
        bottomSheetHeight: 50,
        isMobile: false,
        isPreview: false,
      },
      setSidebarTab: (sidebarTab) =>
        set((state) => ({
          ui: { ...state.ui, sidebarTab },
        })),
      setBottomSheetHeight: (bottomSheetHeight) =>
        set((state) => ({
          ui: { ...state.ui, bottomSheetHeight },
        })),
      setIsMobile: (isMobile) =>
        set((state) => ({
          ui: { ...state.ui, isMobile },
        })),
      setIsPreview: (isPreview) =>
        set((state) => ({
          ui: { ...state.ui, isPreview },
        })),

      // State restoration
      stateBefore: null,
      setStateBefore: (stateBefore) => set({ stateBefore }),
    }))
  )
)
