import { useStore } from '@/store'

// Snap heights for overview mode
export const OVERVIEW_SNAP_HEIGHTS = [10, 30, 50, 70]

// Threshold for considering a height "snapped"
export const SNAP_THRESHOLD = 2

// Helper to get snap heights based on view mode
export function getSnapHeights(viewMode: string, storyContentHeight: number | null): number[] {
  if (viewMode === 'story' && storyContentHeight !== null) {
    return [10, storyContentHeight]
  }
  return OVERVIEW_SNAP_HEIGHTS
}

// Helper to check if height is snapped
export function isHeightSnapped(height: number, snapHeights: number[]): boolean {
  return snapHeights.some((snap) => Math.abs(height - snap) < SNAP_THRESHOLD)
}

export function useBottomSheetSnap() {
  const viewMode = useStore((state) => state.tweets.viewMode)
  const bottomSheetHeight = useStore((state) => state.ui.bottomSheetHeight)
  const contentHeight = useStore((state) => state.ui.storyContentHeight)

  const isStoryMode = viewMode === 'story'
  const snapHeights = getSnapHeights(viewMode, contentHeight)
  const isSnapped = isHeightSnapped(bottomSheetHeight, snapHeights)

  // Get the nearest snap height
  const nearestSnap = snapHeights.reduce((nearest, snap) =>
    Math.abs(bottomSheetHeight - snap) < Math.abs(bottomSheetHeight - nearest) ? snap : nearest
  )

  // Snap to appropriate height based on current height
  const snapToHeight = (height: number, setHeight: (h: number) => void) => {
    if (isStoryMode) {
      const maxHeight = contentHeight ?? 90
      if (height < 20) {
        setHeight(10)
      } else {
        setHeight(maxHeight)
      }
    } else {
      if (height < 20) {
        setHeight(10)
      } else if (height < 40) {
        setHeight(30)
      } else if (height < 60) {
        setHeight(50)
      } else {
        setHeight(70)
      }
    }
  }

  return {
    snapHeights,
    isSnapped,
    nearestSnap,
    snapToHeight,
    isStoryMode,
    contentHeight,
  }
}
