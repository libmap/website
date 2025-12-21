import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'

const STORAGE_KEY = 'libmap-hide-welcome'

export function WelcomeDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const hasDecidedRef = useRef(false)
  const activeTweetId = useStore((state) => state.tweets.activeTweetId)
  const urlToTweetId = useStore((state) => state.tweets.urlToTweetId)
  const tweetsLoaded = useStore((state) => state.tweets.data.size > 0)

  useEffect(() => {
    // Only decide once on initial load
    if (hasDecidedRef.current) return

    // Wait for tweets to load before deciding
    if (!tweetsLoaded) return

    // Mark that we've made the decision
    hasDecidedRef.current = true

    // Don't show if a message is active (e.g., from URL)
    if (activeTweetId) {
      return
    }

    // Check if the current URL matches a tweet
    const currentPath = decodeURIComponent(window.location.pathname + window.location.search)
    const matchesTweet = urlToTweetId.has(currentPath)
    if (matchesTweet) {
      return
    }

    const hideWelcome = localStorage.getItem(STORAGE_KEY)
    if (!hideWelcome) {
      setIsOpen(true)
    }
  }, [activeTweetId, urlToTweetId, tweetsLoaded])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="welcome-overlay" onClick={handleClose}>
      <div className="welcome-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="welcome-close" onClick={handleClose}>
          &times;
        </button>
        <h2 className="welcome-title">Welcome to libmap.org</h2>
        <p className="welcome-intro">
          Explore posts from around the world, or add your own!
        </p>
        <div className="welcome-instructions">
          <div className="welcome-step">
            <span className="step-number">1</span>
            <span className="step-text">Select layers, zoom, and location</span>
          </div>
          <div className="welcome-step">
            <span className="step-number">2</span>
            <span className="step-text">Copy the map URL</span>
          </div>
          <div className="welcome-step">
            <span className="step-number">3</span>
            <span className="step-text">
              Post to Bluesky or Mastodon - your message appears here!
            </span>
          </div>
        </div>
        <label className="welcome-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <span>Don't show this again</span>
        </label>
        <button type="button" className="welcome-btn" onClick={handleClose}>
          Got it!
        </button>
      </div>
    </div>
  )
}
