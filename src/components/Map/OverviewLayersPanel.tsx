import { useStore } from '@/store'
import { BASE_TILES, OVERLAY_LAYERS, POINT_LAYERS } from '@/lib/layers'
import { InfoTooltip } from '@/components/common/InfoTooltip'

export function OverviewLayersPanel() {
  const visibleLayers = useStore((state) => state.layers.visible)
  const setVisibleLayers = useStore((state) => state.setVisibleLayers)

  // Get visible base layer
  const currentBase = visibleLayers.find((id) => BASE_TILES.some((t) => t.id === id)) ?? 'satellite'

  // Get visible overlay layer
  const currentOverlay =
    visibleLayers.find((id) => OVERLAY_LAYERS.some((o) => o.id === id)) ?? 'none'

  const handleBaseChange = (layerId: string) => {
    const withoutBase = visibleLayers.filter((id) => !BASE_TILES.some((t) => t.id === id))
    setVisibleLayers([layerId, ...withoutBase])
  }

  const handleOverlayChange = (layerId: string) => {
    if (layerId === 'none') {
      const withoutOverlay = visibleLayers.filter((id) => !OVERLAY_LAYERS.some((o) => o.id === id))
      setVisibleLayers(withoutOverlay)
    } else {
      const withoutOverlay = visibleLayers.filter((id) => !OVERLAY_LAYERS.some((o) => o.id === id))
      setVisibleLayers([...withoutOverlay, layerId])
    }
  }

  // Filter out hidden layers
  const visibleBaseTiles = BASE_TILES.filter((layer) => !layer.hidden)
  const visibleOverlays = OVERLAY_LAYERS.filter((layer) => !layer.hidden)
  const visiblePoints = POINT_LAYERS.filter((layer) => !layer.hidden)

  const handleOverlayToggle = (layerId: string) => {
    if (visibleLayers.includes(layerId)) {
      setVisibleLayers(visibleLayers.filter((id) => id !== layerId))
    } else {
      setVisibleLayers([...visibleLayers, layerId])
    }
  }

  return (
    <div className="overview-layers-panel">
      {/* Messages Layer (moved to top) */}
      <div className="layer-group compact">
        <div className="layer-options">
          <label className="layer-option checkbox compact">
            <input
              type="checkbox"
              checked={visibleLayers.includes('tweets')}
              onChange={() => handleOverlayToggle('tweets')}
            />
            <span className="layer-name">Messages</span>
          </label>
        </div>
      </div>

      {/* Base Layers */}
      <div className="layer-group compact">
        <div className="layer-options">
          {visibleBaseTiles.map((layer) => (
            <label key={layer.id} className="layer-option radio compact">
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
      </div>

      {/* Overlay Layers */}
      <div className="layer-group compact">
        <div className="layer-options">
          <label className="layer-option radio compact">
            <input
              type="radio"
              name="overlayLayer"
              checked={currentOverlay === 'none'}
              onChange={() => handleOverlayChange('none')}
            />
            <span className="layer-name">None</span>
          </label>
          {visibleOverlays.map((layer) => (
            <label key={layer.id} className="layer-option radio compact">
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
      </div>

      {/* Point Layers */}
      <div className="layer-group compact">
        <div className="layer-options">
          {visiblePoints.map((layer) => (
            <label key={layer.id} className="layer-option checkbox compact">
              <input
                type="checkbox"
                checked={visibleLayers.includes(layer.id)}
                onChange={() => handleOverlayToggle(layer.id)}
              />
              <span className="layer-name">
                {layer.name}
                {layer.citation && <InfoTooltip citation={layer.citation} iconSize={12} />}
              </span>
              <span
                className="layer-color"
                style={{ backgroundColor: layer.color, width: 12, height: 12, borderRadius: '50%' }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
