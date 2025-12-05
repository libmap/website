import { useStore } from '@/store'

export function SearchInViewButton() {
  const filterByBounds = useStore((state) => state.tweets.filterByBounds)
  const setFilterByBounds = useStore((state) => state.setFilterByBounds)
  const map = useStore((state) => state.map.instance)

  const handleClick = () => {
    const newValue = !filterByBounds

    if (newValue && map) {
      // Capture current bounds when turning ON the filter
      const currentBounds = map.getBounds()
      setFilterByBounds(true, currentBounds)
    } else {
      // Clear frozen bounds when turning OFF the filter
      setFilterByBounds(false, null)
    }
  }

  return (
    <button
      type="button"
      className={`search-in-view-btn ${filterByBounds ? 'active' : ''}`}
      onClick={handleClick}
      title={filterByBounds ? 'Show all messages' : 'Search messages in view'}
    >
      {filterByBounds ? (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 2L14 14M14 2L2 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Clear filter
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" />
            <path d="M11 11L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Search messages in view
        </>
      )}
    </button>
  )
}
