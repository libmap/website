import type { IControl } from 'maplibre-gl'
import { useStore } from '@/store'
import { buildUrl } from '@/hooks/useUrlState'

export class ShareLinkControl implements IControl {
  private _container: HTMLDivElement | undefined

  onAdd(): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.className = 'maplibregl-ctrl-share'
    button.type = 'button'
    button.title = 'Share Link'
    button.setAttribute('aria-label', 'Share Link')
    button.innerHTML =
      '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>'
    button.addEventListener('click', this._shareLink)

    this._container.appendChild(button)
    return this._container
  }

  private _shareLink = (): void => {
    const state = useStore.getState()
    const urlState = {
      center: state.map.center,
      zoom: state.map.zoom,
      layers: state.layers.visible,
      tweetId: state.tweets.activeTweetId || undefined,
      account: state.tweets.filters.account || undefined,
      hashtag: state.tweets.filters.hashtag || undefined,
    }

    const url = buildUrl(urlState)
    const fullUrl = `${window.location.origin}${url}`

    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        // Could add a toast notification here if desired
        console.log('Link copied to clipboard:', fullUrl)
      })
      .catch((err) => {
        console.error('Failed to copy link:', err)
      })
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}
