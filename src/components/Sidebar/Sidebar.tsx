import { useStore } from '@/store'
import { StoryViewer } from './MessagesPanel'
import { BottomSheet } from './BottomSheet'
import { OverviewBox } from '../Map/OverviewBox'

export function Sidebar() {
  const isMobile = useStore((state) => state.ui.isMobile)
  const viewMode = useStore((state) => state.tweets.viewMode)

  // Mobile: Always use BottomSheet with OverviewBox
  if (isMobile) {
    const mobileContent = (
      <div className="sidebar-content">
        {viewMode === 'story' ? <StoryViewer /> : <OverviewBox />}
      </div>
    )
    return <BottomSheet>{mobileContent}</BottomSheet>
  }

  // Desktop: Messages panel (both overview and story) is rendered on map as floating box
  // Sidebar is hidden since OverviewBox handles both messages and layers
  return null
}
