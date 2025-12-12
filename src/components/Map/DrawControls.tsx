import { useEffect, useRef } from 'react'
import { IControl } from 'maplibre-gl'
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import { TerraDrawPolygonMode, TerraDrawLineStringMode, TerraDrawFreehandMode } from 'terra-draw'
import { DrawColorPicker } from './controls'

interface DrawControlsProps {
  map: maplibregl.Map | null
  controlsRef: React.MutableRefObject<{
    draw?: MaplibreTerradrawControl
    drawColorPicker?: DrawColorPicker
  }>
}

export function DrawControls({ map, controlsRef }: DrawControlsProps) {
  const drawColorRef = useRef<string>('#E74C3C')

  useEffect(() => {
    if (!map) return

    // Function to create draw control with current color
    const createDrawControl = (color: string) => {
      return new MaplibreTerradrawControl({
        modes: ['linestring', 'polygon', 'freehand', 'select', 'delete', 'download'],
        open: true,
        modeOptions: {
          polygon: new TerraDrawPolygonMode({
            styles: {
              fillColor: color as any,
              fillOpacity: 0.4,
              outlineColor: color as any,
              outlineWidth: 2,
              closingPointColor: color as any,
              closingPointOutlineColor: '#ffffff' as any,
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            },
          }),
          linestring: new TerraDrawLineStringMode({
            styles: {
              lineStringColor: color as any,
              lineStringWidth: 3,
              closingPointColor: color as any,
              closingPointOutlineColor: '#ffffff' as any,
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            },
          }),
          freehand: new TerraDrawFreehandMode({
            styles: {
              lineStringColor: color as any,
              lineStringWidth: 3,
              closingPointColor: color as any,
              closingPointOutlineColor: '#ffffff' as any,
              closingPointWidth: 4,
              closingPointOutlineWidth: 2,
            } as any,
          }),
        },
      })
    }

    // Initialize color picker
    const colorPicker = new DrawColorPicker((color) => {
      drawColorRef.current = color

      // Preserve existing features before removing
      const existingFeatures = controlsRef.current.draw?.getFeatures()

      // Remove and re-add draw control with new color
      if (controlsRef.current.draw) {
        map.removeControl(controlsRef.current.draw as unknown as IControl)
      }
      const newDraw = createDrawControl(color)
      map.addControl(newDraw as unknown as IControl, 'top-right')
      controlsRef.current.draw = newDraw

      // Re-inject color button into new Terra Draw toolbar
      setTimeout(() => {
        let newContainer =
          document.querySelector('.maplibregl-terradraw-list') ||
          document.querySelector('.maplibregl-ctrl-terradraw') ||
          document.querySelector('[class*="terradraw"]')

        if (!newContainer) {
          const allElements = document.querySelectorAll('[class*="terradraw"]')
          newContainer = allElements[0] || null
        }

        if (newContainer) {
          const colorButton = colorPicker.createColorButton(newContainer as HTMLElement)
          newContainer.appendChild(colorButton as Node)
        }
      }, 100)

      // Restore existing features after a short delay to ensure Terra Draw is enabled
      if (existingFeatures && existingFeatures.features.length > 0) {
        setTimeout(() => {
          try {
            const terraDrawInstance = newDraw.getTerraDrawInstance()
            // Activate the draw control if not already active
            if (!terraDrawInstance.enabled) {
              newDraw.activate()
            }
            existingFeatures.features.forEach((feature) => {
              terraDrawInstance.addFeatures([feature])
            })
          } catch (error) {
            console.warn('Failed to restore features after color change:', error)
          }
        }, 100)
      }
    })
    controlsRef.current.drawColorPicker = colorPicker

    // Initialize Terra Draw control with default color
    const draw = createDrawControl(drawColorRef.current)
    map.addControl(draw as unknown as IControl, 'top-right')
    controlsRef.current.draw = draw

    // Inject color button into Terra Draw toolbar after it's rendered
    setTimeout(() => {
      // Access the control container directly from the draw control instance
      const drawControl = draw as any
      const terraDrawContainer = drawControl.controlContainer

      if (terraDrawContainer) {
        console.log('Found Terra Draw container:', terraDrawContainer.className)
        const colorButton = colorPicker.createColorButton(terraDrawContainer as HTMLElement)
        terraDrawContainer.appendChild(colorButton)
      } else {
        console.error('Terra Draw container not found')
      }
    }, 200)

    // Cleanup
    return () => {
      if (controlsRef.current.draw) {
        map.removeControl(controlsRef.current.draw as unknown as IControl)
      }
      if (controlsRef.current.drawColorPicker) {
        controlsRef.current.drawColorPicker.destroy()
      }
    }
  }, [map, controlsRef])

  return null
}
