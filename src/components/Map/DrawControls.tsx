import { useEffect, useRef } from 'react'
import { IControl } from 'maplibre-gl'
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import {
  TerraDrawPolygonMode,
  TerraDrawLineStringMode,
  TerraDrawFreehandMode,
  TerraDrawSelectMode,
  type HexColor,
  type GeoJSONStoreFeatures,
} from 'terra-draw'
import { DrawColorPicker, DrawImportButton } from './controls'
import { useStore } from '@/store'

const WHITE: HexColor = '#ffffff'

// Drawings above this JSON length are not synced into the shareable URL
const MAX_URL_GEOJSON_LENGTH = 8000

type FeatureId = string | number

interface DrawControlsProps {
  map: maplibregl.Map | null
  controlsRef: React.MutableRefObject<{
    draw?: MaplibreTerradrawControl
    drawColorPicker?: DrawColorPicker
  }>
}

export function DrawControls({ map, controlsRef }: DrawControlsProps) {
  const drawColorRef = useRef<HexColor>('#E74C3C')
  const setDrawings = useStore((state) => state.setDrawings)

  useEffect(() => {
    if (!map) return

    // Each feature keeps the color it was drawn with in its GeoJSON
    // properties (so downloads carry it); the picker only sets the color for
    // the next feature (or the currently selected one)
    const featureColor = (feature: GeoJSONStoreFeatures): HexColor =>
      (feature.properties?.color as HexColor | undefined) ?? drawColorRef.current
    const activeColor = (): HexColor => drawColorRef.current

    const polygonStyles = {
      fillColor: featureColor,
      fillOpacity: 0.4,
      outlineColor: featureColor,
      outlineWidth: 2,
      closingPointColor: activeColor,
      closingPointOutlineColor: WHITE,
      closingPointWidth: 4,
      closingPointOutlineWidth: 2,
    }

    const linestringStyles = {
      lineStringColor: featureColor,
      lineStringWidth: 3,
      closingPointColor: activeColor,
      closingPointOutlineColor: WHITE,
      closingPointWidth: 4,
      closingPointOutlineWidth: 2,
    }

    const freehandStyles = {
      fillColor: featureColor,
      fillOpacity: 0.4,
      outlineColor: featureColor,
      outlineWidth: 3,
      closingPointColor: activeColor,
      closingPointOutlineColor: WHITE,
      closingPointWidth: 4,
      closingPointOutlineWidth: 2,
    }

    // Selected features are styled by the select mode, so mirror the
    // per-feature colors there too (flags are merged in by the control)
    const selectStyles = {
      selectedPolygonColor: featureColor,
      selectedPolygonFillOpacity: 0.4,
      selectedPolygonOutlineColor: featureColor,
      selectedPolygonOutlineWidth: 2,
      selectedLineStringColor: featureColor,
      selectedLineStringWidth: 3,
    }

    const draw = new MaplibreTerradrawControl({
      modes: ['linestring', 'polygon', 'freehand', 'select', 'delete', 'download'],
      open: true,
      modeOptions: {
        polygon: new TerraDrawPolygonMode({ styles: polygonStyles }),
        linestring: new TerraDrawLineStringMode({ styles: linestringStyles }),
        freehand: new TerraDrawFreehandMode({ styles: freehandStyles }),
        select: new TerraDrawSelectMode({ styles: selectStyles }),
      },
    })
    map.addControl(draw as unknown as IControl, 'bottom-left')
    controlsRef.current.draw = draw

    // The control only starts Terra Draw when map.loaded() is true; its
    // map.once('load') fallback never fires when the control is added after
    // the 'load' event while tiles are still pending, leaving the toolbar
    // dead. activate() is an idempotent "start if not started".
    draw.activate()

    // Stamp finished features with the active color and track selection
    const terraDraw = draw.getTerraDrawInstance()
    let selectedId: FeatureId | null = null

    // (1e9 = terra-draw's validation precision; 1e5 ≈ 1m, used for URLs)
    const roundCoords = (value: unknown, factor = 1e9): unknown =>
      Array.isArray(value)
        ? value.map((v) => roundCoords(v, factor))
        : typeof value === 'number'
          ? Math.round(value * factor) / factor
          : value

    // Mirror the drawn shapes into the store (and thus the shareable URL) as
    // a compact GeoJSON string. selfData marks values we wrote ourselves so
    // the store subscription below can tell foreign updates from our own.
    let selfData: string | null = null
    let urlSizeWarned = false

    const syncDrawings = () => {
      const features = draw.getFeatures()?.features ?? []
      if (features.length === 0) {
        selfData = null
        setDrawings(null)
        return
      }
      const compact = {
        type: 'FeatureCollection',
        features: features.map((f) => ({
          type: 'Feature',
          geometry: roundCoords(f.geometry, 1e5),
          properties: {
            mode: f.properties?.mode,
            ...(typeof f.properties?.color === 'string' ? { color: f.properties.color } : {}),
          },
        })),
      }
      const data = JSON.stringify(compact)
      if (data.length > MAX_URL_GEOJSON_LENGTH) {
        if (!urlSizeWarned) {
          urlSizeWarned = true
          alert('The drawing is too large to share via URL — new shapes will not be added to it.')
        }
        return
      }
      urlSizeWarned = false
      selfData = data
      setDrawings(data)
    }

    const onFinish = (id: FeatureId, context: { action: string }) => {
      // Only stamp newly drawn features; 'finish' also fires after drag/edit
      if (context.action === 'draw') {
        terraDraw.updateFeatureProperties(id, { color: drawColorRef.current })
      }
      syncDrawings()
    }
    const onSelect = (id: FeatureId) => {
      selectedId = id
    }
    const onDeselect = () => {
      selectedId = null
    }
    terraDraw.on('finish', onFinish)
    terraDraw.on('select', onSelect)
    terraDraw.on('deselect', onDeselect)

    const colorPicker = new DrawColorPicker((newColor) => {
      const color = newColor as HexColor
      drawColorRef.current = color

      // Recolor the currently selected feature, if any
      if (selectedId != null) {
        try {
          terraDraw.updateFeatureProperties(selectedId, { color })
          syncDrawings()
        } catch (error) {
          console.warn('Failed to recolor selected feature:', error)
        }
      }
    })
    controlsRef.current.drawColorPicker = colorPicker

    // Import: accept a GeoJSON FeatureCollection, normalize the features to
    // what our terra-draw modes can render, and add them to the store
    const GEOMETRY_MODES: Record<string, string> = {
      Polygon: 'polygon',
      LineString: 'linestring',
    }
    const REGISTERED_MODES = ['polygon', 'linestring', 'freehand']

    const importFeatures = (parsed: unknown, opts: { silent?: boolean; sync?: boolean } = {}) => {
      const fc = parsed as {
        type?: string
        features?: {
          type?: string
          geometry?: { type?: string; coordinates?: unknown }
          properties?: Record<string, unknown>
        }[]
      }
      if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        if (!opts.silent) alert('File is not a GeoJSON FeatureCollection')
        return
      }

      const features: GeoJSONStoreFeatures[] = []
      for (const f of fc.features) {
        const geomType = f?.geometry?.type
        if (f?.type !== 'Feature' || !geomType) continue

        // Use the feature's own mode if it is one of ours, otherwise infer it
        // from the geometry; skip unsupported geometries (points, multi-*)
        const ownMode = typeof f.properties?.mode === 'string' ? f.properties.mode : undefined
        const mode = ownMode && REGISTERED_MODES.includes(ownMode) ? ownMode : GEOMETRY_MODES[geomType]
        if (!mode) continue
        if ((mode === 'linestring') !== (geomType === 'LineString')) continue

        const color =
          typeof f.properties?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.properties.color)
            ? f.properties.color
            : undefined

        features.push({
          type: 'Feature',
          geometry: roundCoords(f.geometry),
          properties: { mode, ...(color ? { color } : {}) },
        } as GeoJSONStoreFeatures)
      }

      if (features.length === 0) {
        if (!opts.silent) alert('No compatible features (polygons or lines) found in file')
        return
      }

      const results = terraDraw.addFeatures(features)
      const rejected = results.filter((r) => !r.valid)
      if (rejected.length > 0) {
        console.warn('Some features could not be imported:', rejected)
      }
      // Re-enable select/delete/download buttons (normally only refreshed on draw)
      ;(draw as unknown as { toggleButtonsWhenNoFeature?: () => void }).toggleButtonsWhenNoFeature?.()
      if (opts.sync) syncDrawings()
    }

    const importButton = new DrawImportButton((parsed) => importFeatures(parsed, { sync: true }))

    // Load shared drawings: either inline GeoJSON from the URL (current and
    // legacy format, possibly still URI-encoded) or a remote GeoJSON link
    const loadFromData = (data: string) => {
      if (/^https?:\/\//.test(data)) {
        fetch(data)
          .then((res) => res.json())
          .then((json) => importFeatures(json, { silent: true }))
          .catch((error) => console.warn('Failed to load shared drawing URL:', error))
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        try {
          parsed = JSON.parse(decodeURIComponent(data))
        } catch {
          console.warn('Could not parse shared drawings from URL')
          return
        }
      }
      importFeatures(parsed, { silent: true })
    }

    // Load drawings already present in the store (from the initial URL), and
    // follow later external changes (e.g. a tweet view applying its URL)
    selfData = useStore.getState().drawings
    if (selfData) loadFromData(selfData)

    const unsubscribeDrawings = useStore.subscribe(
      (state) => state.drawings,
      (data) => {
        if (data === selfData) return
        selfData = data
        terraDraw.clear()
        if (data) loadFromData(data)
      }
    )

    const onFeatureDeleted = () => syncDrawings()
    draw.on('feature-deleted', onFeatureDeleted)

    // Inject the import and color buttons into the toolbar once it has
    // rendered (controlContainer is protected on MaplibreTerradrawControl)
    const injectTimeout = setTimeout(() => {
      const container = (draw as unknown as { controlContainer?: HTMLElement }).controlContainer
      if (container) {
        container.appendChild(importButton.createButton())
        container.appendChild(colorPicker.createColorButton(container))
      } else {
        console.error('Terra Draw container not found')
      }
    }, 200)

    // Cleanup
    return () => {
      clearTimeout(injectTimeout)
      unsubscribeDrawings()
      draw.off('feature-deleted', onFeatureDeleted)
      terraDraw.off('finish', onFinish)
      terraDraw.off('select', onSelect)
      terraDraw.off('deselect', onDeselect)
      map.removeControl(draw as unknown as IControl)
      colorPicker.destroy()
      importButton.destroy()
    }
  }, [map, controlsRef, setDrawings])

  return null
}
