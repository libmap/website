import { useStore } from '@/store'

export function SearchInViewButton() {
  const filterByBounds = useStore((state) => state.tweets.filterByBounds)
  const setFilterByBounds = useStore((state) => state.setFilterByBounds)
  const map = useStore((state) => state.map.instance)

  // Always (re-)applies the filter for the current view; clearing happens
  // via the "Clear filter" row at the end of the messages list
  const handleClick = () => {
    if (!map) return
    setFilterByBounds(true, map.getBounds())
  }

  return (
    <button
      type="button"
      className={`search-in-view-btn ${filterByBounds ? 'active' : ''}`}
      onClick={handleClick}
      title={filterByBounds ? 'Update filter to current view' : 'Search messages in view'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" />
        <path d="M11 11L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Search messages in view
    </button>
  )
}
