import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '@/store'

/**
 * Minimal controls for preview mode (OG image generation)
 * Only shows the scale control (distance meter) at bottom-right
 */
export function PreviewControls() {
  const map = useStore((state) => state.map.instance)
  const controlsRef = useRef<{
    scale?: maplibregl.ScaleControl
  }>({})

  useEffect(() => {
    if (!map) return

    // Scale control (distance meter)
    const scaleControl = new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric',
    })
    map.addControl(scaleControl, 'bottom-right')
    controlsRef.current.scale = scaleControl

    // Cleanup
    return () => {
      if (controlsRef.current.scale) {
        map.removeControl(controlsRef.current.scale)
      }
      controlsRef.current = {}
    }
  }, [map])

  return null
}
