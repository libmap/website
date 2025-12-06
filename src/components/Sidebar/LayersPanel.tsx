import { useStore } from '@/store'
import { BASE_TILES, OVERLAY_LAYERS, POINT_LAYERS } from '@/lib/layers'

export function LayersPanel() {
  const visibleLayers = useStore((state) => state.layers.visible)
  const setVisibleLayers = useStore((state) => state.setVisibleLayers)

  // Get visible base tiles (non-hidden)
  const visibleBaseTiles = BASE_TILES.filter((t) => !t.hidden)

  // Get visible overlays
  const visibleOverlays = OVERLAY_LAYERS.filter((o) => !o.hidden)

  // Get visible point layers
  const visiblePoints = POINT_LAYERS.filter((p) => !p.hidden)

  // Current base layer (first visible base tile)
  const currentBase = visibleLayers.find((id) => BASE_TILES.some((t) => t.id === id)) ?? 'satellite'

  // Current overlay layer (first visible overlay)
  const currentOverlay = visibleLayers.find((id) => OVERLAY_LAYERS.some((o) => o.id === id)) ?? 'none'

  const handleBaseChange = (newBase: string) => {
    // Remove old base, add new one
    const withoutBase = visibleLayers.filter((id) => !BASE_TILES.some((t) => t.id === id))
    setVisibleLayers([newBase, ...withoutBase])
  }

  const handleOverlayChange = (newOverlay: string) => {
    // Remove old overlay
    const withoutOverlay = visibleLayers.filter((id) => !OVERLAY_LAYERS.some((o) => o.id === id))

    // Add new overlay if not 'none'
    if (newOverlay === 'none') {
      setVisibleLayers(withoutOverlay)
    } else {
      setVisibleLayers([...withoutOverlay, newOverlay])
    }
  }

  const handleOverlayToggle = (layerId: string) => {
    if (visibleLayers.includes(layerId)) {
      setVisibleLayers(visibleLayers.filter((id) => id !== layerId))
    } else {
      setVisibleLayers([...visibleLayers, layerId])
    }
  }

  return (
    <div className="layers-panel">
      {/* Base Layers */}
      <section className="layer-group">
        <h3 className="group-title">Base Map</h3>
        <div className="layer-options">
          {visibleBaseTiles.map((layer) => (
            <label key={layer.id} className="layer-option radio">
              <input
                type="radio"
                name="baseLayer"
                checked={currentBase === layer.id}
                onChange={() => handleBaseChange(layer.id)}
              />
              <span className="layer-name">{layer.name}</span>
            </label>
          ))}
        </div>
      </section>

      {/* NO2 Overlays */}
      <section className="layer-group">
        <h3 className="group-title">NO₂ Pollution</h3>
        <div className="layer-options">
          <label className="layer-option radio">
            <input
              type="radio"
              name="overlayLayer"
              checked={currentOverlay === 'none'}
              onChange={() => handleOverlayChange('none')}
            />
            <span className="layer-name">None</span>
          </label>
          {visibleOverlays.map((layer) => (
            <label key={layer.id} className="layer-option radio">
              <input
                type="radio"
                name="overlayLayer"
                checked={currentOverlay === layer.id}
                onChange={() => handleOverlayChange(layer.id)}
              />
              <span className="layer-name">{layer.name}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Point Layers */}
      <section className="layer-group">
        <h3 className="group-title">Emissions & Infrastructure</h3>
        <div className="layer-options">
          {visiblePoints.map((layer) => (
            <label key={layer.id} className="layer-option checkbox">
              <input
                type="checkbox"
                checked={visibleLayers.includes(layer.id)}
                onChange={() => handleOverlayToggle(layer.id)}
              />
              <span className="layer-name">{layer.name}</span>
              <span
                className="layer-color"
                style={{ backgroundColor: layer.color, width: 12, height: 12, borderRadius: '50%' }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Tweets Layer */}
      <section className="layer-group">
        <h3 className="group-title">Social</h3>
        <div className="layer-options">
          <label className="layer-option checkbox">
            <input
              type="checkbox"
              checked={visibleLayers.includes('tweets')}
              onChange={() => handleOverlayToggle('tweets')}
            />
            <span className="layer-name">Messages</span>
          </label>
        </div>
      </section>
    </div>
  )
}
