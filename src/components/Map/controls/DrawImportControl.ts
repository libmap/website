// Toolbar button that opens a file picker and parses a GeoJSON file.
// Follows the same inject-into-terradraw-toolbar pattern as DrawColorPicker.
export class DrawImportButton {
  private button: HTMLButtonElement | null = null
  private input: HTMLInputElement | null = null
  private onImport: (parsed: unknown) => void

  constructor(onImport: (parsed: unknown) => void) {
    this.onImport = onImport
  }

  createButton(): HTMLButtonElement {
    this.input = document.createElement('input')
    this.input.type = 'file'
    this.input.accept = '.geojson,.json,application/geo+json,application/json'
    this.input.style.display = 'none'

    this.input.addEventListener('change', () => {
      const file = this.input?.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        try {
          this.onImport(JSON.parse(String(reader.result)))
        } catch {
          alert('Could not read file: not valid GeoJSON')
        }
        // Allow re-importing the same file
        if (this.input) this.input.value = ''
      }
      reader.readAsText(file)
    })

    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'maplibregl-terradraw-add-control'
    this.button.title = 'Import GeoJSON'
    this.button.setAttribute('aria-label', 'Import GeoJSON')
    // Material Symbols "upload" glyph, matching the toolbar's download icon
    // (same icon set, color, and sizing as the terradraw CSS)
    this.button.style.background = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='%235f6368' viewBox='0 -960 960 960'%3E%3Cpath d='M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326zM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160z'/%3E%3C/svg%3E")`
    this.button.style.backgroundPosition = '50%'
    this.button.style.backgroundRepeat = 'no-repeat'
    this.button.style.backgroundSize = '90%'
    this.button.appendChild(this.input)
    this.button.addEventListener('click', (e) => {
      e.stopPropagation()
      this.input?.click()
    })

    return this.button
  }

  destroy(): void {
    this.button?.remove()
    this.button = null
    this.input = null
  }
}
