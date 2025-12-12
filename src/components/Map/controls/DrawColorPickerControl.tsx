const COLORS = [
  '#E74C3C',
  '#FF0066',
  '#9B59B6',
  '#673AB7',
  '#3F51B5',
  '#3498DB',
  '#03A9F4',
  '#00BCD4',
  '#009688',
  '#27AE60',
  '#8BC34A',
  '#CDDC39',
  '#F1C40F',
  '#FFC107',
  '#F39C12',
  '#FF5722',
  '#795548',
]

export class DrawColorPicker {
  private paletteContainer: HTMLDivElement | null = null
  private colorButton: HTMLButtonElement | null = null
  private selectedColor: string = COLORS[0]
  private onColorChange?: (color: string) => void
  private isOpen: boolean = false

  constructor(onColorChange?: (color: string) => void) {
    this.onColorChange = onColorChange
  }

  createColorButton(terraDrawContainer: HTMLElement): HTMLButtonElement {
    // Create color button
    this.colorButton = document.createElement('button')
    this.colorButton.type = 'button'
    this.colorButton.className = 'maplibregl-terradraw-mode'
    this.colorButton.title = 'Change drawing color'
    this.colorButton.setAttribute('aria-label', 'Change drawing color')

    // Create color indicator inside button
    const colorIndicator = document.createElement('span')
    colorIndicator.style.display = 'block'
    colorIndicator.style.width = '20px'
    colorIndicator.style.height = '20px'
    colorIndicator.style.backgroundColor = this.selectedColor
    colorIndicator.style.border = '2px solid white'
    colorIndicator.style.borderRadius = '3px'
    colorIndicator.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.1)'
    this.colorButton.appendChild(colorIndicator)

    // Create color palette container
    this.paletteContainer = document.createElement('div')
    this.paletteContainer.className = 'draw-color-palette'
    this.paletteContainer.style.display = 'none'
    this.paletteContainer.style.position = 'absolute'
    this.paletteContainer.style.top = '0'
    this.paletteContainer.style.left = '100%'
    this.paletteContainer.style.marginLeft = '8px'
    this.paletteContainer.style.padding = '8px'
    this.paletteContainer.style.backgroundColor = 'white'
    this.paletteContainer.style.borderRadius = '4px'
    this.paletteContainer.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.1)'
    this.paletteContainer.style.display = 'none'
    this.paletteContainer.style.flexWrap = 'wrap'
    this.paletteContainer.style.gap = '4px'
    this.paletteContainer.style.maxWidth = '176px'
    this.paletteContainer.style.zIndex = '1000'

    // Add color buttons to palette
    COLORS.forEach((color) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.style.width = '24px'
      button.style.height = '24px'
      button.style.backgroundColor = color
      button.style.border = color === this.selectedColor ? '2px solid #333' : '1px solid #ddd'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.style.padding = '0'
      button.title = color

      button.addEventListener('click', (e) => {
        e.stopPropagation()
        this.selectedColor = color
        this.updateSelection()
        this.updateColorIndicator()
        if (this.onColorChange) {
          this.onColorChange(color)
        }
        this.closePalette()
      })

      this.paletteContainer!.appendChild(button)
    })

    // Toggle palette on button click
    this.colorButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.togglePalette()
    })

    // Position the palette container relative to the terra draw container
    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'
    wrapper.appendChild(this.colorButton)
    wrapper.appendChild(this.paletteContainer)

    // Close palette when clicking outside
    document.addEventListener('click', (e) => {
      if (
        this.isOpen &&
        this.paletteContainer &&
        !this.paletteContainer.contains(e.target as Node) &&
        !this.colorButton?.contains(e.target as Node)
      ) {
        this.closePalette()
      }
    })

    return wrapper as unknown as HTMLButtonElement
  }

  private togglePalette(): void {
    if (this.isOpen) {
      this.closePalette()
    } else {
      this.openPalette()
    }
  }

  private openPalette(): void {
    if (this.paletteContainer) {
      this.paletteContainer.style.display = 'flex'
      this.isOpen = true
      this.colorButton?.classList.add('active')
    }
  }

  private closePalette(): void {
    if (this.paletteContainer) {
      this.paletteContainer.style.display = 'none'
      this.isOpen = false
      this.colorButton?.classList.remove('active')
    }
  }

  private updateColorIndicator(): void {
    if (this.colorButton) {
      const indicator = this.colorButton.querySelector('span')
      if (indicator) {
        indicator.style.backgroundColor = this.selectedColor
      }
    }
  }

  private updateSelection(): void {
    if (!this.paletteContainer) return

    const buttons = this.paletteContainer.querySelectorAll('button')
    buttons.forEach((button) => {
      const color = button.style.backgroundColor
      // Convert rgb to hex for comparison
      const isSelected = this.rgbToHex(color) === this.selectedColor.toLowerCase()
      button.style.border = isSelected ? '2px solid #333' : '1px solid #ddd'
      button.style.boxShadow = isSelected ? '0 0 0 2px rgba(0,0,0,0.1)' : 'none'
    })
  }

  private rgbToHex(rgb: string): string {
    // Handle both rgb() and hex formats
    if (rgb.startsWith('#')) return rgb.toLowerCase()

    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
    if (!match) return rgb

    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])

    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16)
          return hex.length === 1 ? '0' + hex : hex
        })
        .join('')
    )
  }

  getSelectedColor(): string {
    return this.selectedColor
  }

  destroy(): void {
    if (this.paletteContainer?.parentNode) {
      this.paletteContainer.parentNode.removeChild(this.paletteContainer)
    }
    this.paletteContainer = null
    this.colorButton = null
  }
}
