import type maplibregl from 'maplibre-gl'
import type { IControl } from 'maplibre-gl'

export class GlobeButtonControl implements IControl {
  private _container: HTMLDivElement | undefined
  private _button: HTMLButtonElement | undefined
  private _map: maplibregl.Map | undefined
  private _isGlobe = false

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    this._button = document.createElement('button')
    this._button.className = 'maplibregl-ctrl-globe'
    this._button.type = 'button'
    this._button.title = 'Toggle 3D Globe'
    this._button.setAttribute('aria-label', 'Toggle 3D Globe')
    this._button.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
    this._button.addEventListener('click', () => this._toggleGlobe())

    this._container.appendChild(this._button)
    return this._container
  }

  private _toggleGlobe(): void {
    if (!this._map) return

    this._isGlobe = !this._isGlobe

    this._map.setProjection({
      type: this._isGlobe ? 'globe' : 'mercator',
    })

    // Update button appearance
    if (this._button) {
      this._button.style.backgroundColor = this._isGlobe ? '#3b82f6' : ''
      this._button.style.color = this._isGlobe ? '#fff' : ''
    }
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}
