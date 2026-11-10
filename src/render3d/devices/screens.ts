import { CanvasTexture, Color, MeshBasicMaterial, SRGBColorSpace } from 'three'

/** What a terminal screen shows: its normal desktop, the player's takeover, or the menu the player has open. */
export type ScreenLook = 'idle' | 'hacked' | 'open'

const WIDTH = 256
const HEIGHT = 160
/** Screens are a little brighter than white so the brightest pixels glow. */
const SCREEN_GAIN = 1.9

type Palette = { back: string; bar: string; text: string; accent: string }
const PALETTES: Record<ScreenLook, Palette> = {
  idle: { back: '#06121f', bar: '#1d4f7a', text: '#5f8fb8', accent: '#9fd2ff' },
  hacked: { back: '#03140a', bar: '#0f5a2a', text: '#2fbf5f', accent: '#8dffb0' },
  open: { back: '#1a1004', bar: '#a8650f', text: '#e0a040', accent: '#ffe2a0' },
}

/** Draws a believable screen: a title bar, rows of text and a status line. Fixed per look, so it is built once. */
function paint(look: ScreenLook): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const c = canvas.getContext('2d')!
  const colours = PALETTES[look]
  c.fillStyle = colours.back
  c.fillRect(0, 0, WIDTH, HEIGHT)
  c.fillStyle = colours.bar
  c.fillRect(0, 0, WIDTH, 18)
  c.fillStyle = colours.accent
  c.font = 'bold 13px monospace'
  c.fillText(look === 'idle' ? 'FACILITY NET  //  WS-04' : look === 'hacked' ? 'REMOTE SESSION  //  ROOT' : 'TERMINAL  //  SELECT', 6, 13)
  c.font = '11px monospace'
  for (let row = 0; row < 9; row += 1) {
    const y = 34 + row * 13
    if (look === 'open' && row < 5) {
      // Menu entries in boxes, like the panel the player sees.
      c.strokeStyle = colours.text
      c.strokeRect(8, y - 10, WIDTH - 16, 12)
      c.fillStyle = row === 0 ? colours.accent : colours.text
      c.fillText(`${row + 1}  ${['DOORS', 'CAMERAS', 'LIGHTS', 'ALARM', 'LOGS'][row]}`, 14, y)
      continue
    }
    c.fillStyle = colours.text
    const length = 40 + ((row * 53) % 150)
    c.fillRect(8, y - 7, length, 6)
    if (row % 3 === 1) c.fillRect(16 + length, y - 7, 30 + ((row * 31) % 40), 6)
  }
  c.fillStyle = colours.accent
  c.fillRect(8, HEIGHT - 12, look === 'hacked' ? WIDTH - 16 : 70, 5)
  // Faint scanlines.
  c.fillStyle = 'rgba(0,0,0,0.25)'
  for (let y = 0; y < HEIGHT; y += 3) c.fillRect(0, y, WIDTH, 1)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

let materials: Record<ScreenLook, MeshBasicMaterial> | null = null

/** One shared material per look, made on first use. */
export function screenMaterial(look: ScreenLook): MeshBasicMaterial {
  materials ??= {
    idle: new MeshBasicMaterial({ map: paint('idle'), color: new Color(SCREEN_GAIN, SCREEN_GAIN, SCREEN_GAIN) }),
    hacked: new MeshBasicMaterial({ map: paint('hacked'), color: new Color(SCREEN_GAIN, SCREEN_GAIN, SCREEN_GAIN) }),
    open: new MeshBasicMaterial({ map: paint('open'), color: new Color(SCREEN_GAIN * 1.2, SCREEN_GAIN * 1.2, SCREEN_GAIN * 1.2) }),
  }
  return materials[look]
}
