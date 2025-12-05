import { useStore } from '@/store'

export function TabNav() {
  const activeTab = useStore((state) => state.ui.sidebarTab)
  const setActiveTab = useStore((state) => state.setSidebarTab)

  return (
    <nav className="tab-nav">
      <button
        className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
        onClick={() => setActiveTab('messages')}
        type="button"
      >
        <span className="tab-icon">💬</span>
        <span className="tab-label">Messages</span>
      </button>
      <button
        className={`tab-button ${activeTab === 'layers' ? 'active' : ''}`}
        onClick={() => setActiveTab('layers')}
        type="button"
      >
        <span className="tab-icon">🗺️</span>
        <span className="tab-label">Layers</span>
      </button>
    </nav>
  )
}
