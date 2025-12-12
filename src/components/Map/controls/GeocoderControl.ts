import type maplibregl from 'maplibre-gl'
import type { IControl } from 'maplibre-gl'

// Geocoder API using Nominatim
const geocoderApi = {
  forwardGeocode: async (config: { query: string }) => {
    const features: Array<{
      type: string
      geometry: { type: string; coordinates: [number, number] }
      place_name: string
      properties: Record<string, unknown>
      center: [number, number]
      bbox?: [number, number, number, number]
    }> = []

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(config.query)}&format=geojson&polygon_geojson=1&addressdetails=1`
      )
      const data = await response.json()

      for (const feature of data.features) {
        const center = feature.bbox
          ? [(feature.bbox[0] + feature.bbox[2]) / 2, (feature.bbox[1] + feature.bbox[3]) / 2]
          : feature.geometry.coordinates

        features.push({
          type: 'Feature',
          geometry: feature.geometry,
          place_name: feature.properties.display_name,
          properties: feature.properties,
          center: center as [number, number],
          bbox: feature.bbox,
        })
      }
    } catch (e) {
      console.error('Geocoding error:', e)
    }

    return { features }
  },
}

export class GeocoderControl implements IControl {
  private _container: HTMLDivElement | undefined
  private _map: maplibregl.Map | undefined
  private _input: HTMLInputElement | undefined
  private _resultsContainer: HTMLDivElement | undefined
  private _isExpanded = false

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-geocoder'

    // Search button
    const searchBtn = document.createElement('button')
    searchBtn.className = 'geocoder-toggle'
    searchBtn.type = 'button'
    searchBtn.title = 'Search location'
    searchBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
    searchBtn.addEventListener('click', () => this.toggleExpand())
    this._container.appendChild(searchBtn)

    // Input wrapper
    const inputWrapper = document.createElement('div')
    inputWrapper.className = 'geocoder-input-wrapper'

    this._input = document.createElement('input')
    this._input.type = 'text'
    this._input.placeholder = 'Search location...'
    this._input.className = 'geocoder-input'
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.search()
      }
    })
    inputWrapper.appendChild(this._input)
    this._container.appendChild(inputWrapper)

    // Results container
    this._resultsContainer = document.createElement('div')
    this._resultsContainer.className = 'geocoder-results'
    this._container.appendChild(this._resultsContainer)

    return this._container
  }

  toggleExpand(): void {
    this._isExpanded = !this._isExpanded
    this._container?.classList.toggle('expanded', this._isExpanded)
    if (this._isExpanded) {
      this._input?.focus()
    }
  }

  async search(): Promise<void> {
    if (!this._input || !this._map || !this._resultsContainer) return

    const query = this._input.value.trim()
    if (!query) return

    const result = await geocoderApi.forwardGeocode({ query })

    this._resultsContainer.innerHTML = ''

    if (result.features.length === 0) {
      this._resultsContainer.innerHTML = '<div class="geocoder-no-results">No results found</div>'
      return
    }

    for (const feature of result.features.slice(0, 5)) {
      const item = document.createElement('div')
      item.className = 'geocoder-result-item'
      item.textContent = feature.place_name
      item.addEventListener('click', () => {
        if (feature.bbox) {
          this._map?.fitBounds(feature.bbox as [number, number, number, number], { padding: 50 })
        } else {
          this._map?.flyTo({ center: feature.center, zoom: 12 })
        }
        this._resultsContainer!.innerHTML = ''
        this._input!.value = ''
        this.toggleExpand()
      })
      this._resultsContainer.appendChild(item)
    }
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }
}
