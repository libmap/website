import { useStore } from '@/store'
import { TabNav } from './TabNav'
import { MessagesPanel } from './MessagesPanel'
import { LayersPanel } from './LayersPanel'
import { BottomSheet } from './BottomSheet'

export function Sidebar() {
  const isMobile = useStore((state) => state.ui.isMobile)
  const activeTab = useStore((state) => state.ui.sidebarTab)

  const content = (
    <>
      <TabNav />
      <div className="sidebar-content">
        {activeTab === 'messages' ? <MessagesPanel /> : <LayersPanel />}
      </div>
    </>
  )

  if (isMobile) {
    return <BottomSheet>{content}</BottomSheet>
  }

  return <aside className="sidebar">{content}</aside>
}
