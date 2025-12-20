import { useStore } from '@/store'
import { TabNav } from './TabNav'
import { StoryViewer } from './MessagesPanel'
import { LayersPanel } from './LayersPanel'
import { BottomSheet } from './BottomSheet'
import { OverviewBox } from '../Map/OverviewBox'

export function Sidebar() {
  const isMobile = useStore((state) => state.ui.isMobile)
  const activeTab = useStore((state) => state.ui.sidebarTab)
  const viewMode = useStore((state) => state.tweets.viewMode)

  // Mobile: Always use BottomSheet
  if (isMobile) {
    const mobileContent = (
      <>
        <TabNav />
        <div className="sidebar-content">
          {activeTab === 'messages' ? (
            viewMode === 'story' ? <StoryViewer /> : <OverviewBox />
          ) : (
            <LayersPanel />
          )}
        </div>
      </>
    )
    return <BottomSheet>{mobileContent}</BottomSheet>
  }

  // Desktop: Messages panel (both overview and story) is rendered on map as floating box
  // Only show sidebar for layers tab
  if (activeTab === 'layers') {
    return (
      <aside className="sidebar">
        <TabNav />
        <div className="sidebar-content">
          <LayersPanel />
        </div>
      </aside>
    )
  }

  // For messages tab on desktop, sidebar is hidden
  // Both OverviewBox and StoryViewer are rendered on the map via MapContainer
  return null
}
