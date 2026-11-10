import type { TileKind } from '../game/tiles'

type Ctx = CanvasRenderingContext2D

/** Repeatable 0..1 noise per tile, so textures look random but never flicker between redraws. */
export function hash(x: number, y: number, salt: number): number {
  let value = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0
  value = (value ^ (value >>> 13)) * 1274126177
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * (1 + amount))))
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`
}

function speckle(c: Ctx, px: number, py: number, s: number, tx: number, ty: number, count: number, dark: string, light: string): void {
  for (let index = 0; index < count; index += 1) {
    c.fillStyle = hash(tx, ty, index + 40) < 0.5 ? dark : light
    const size = s * (0.04 + hash(tx, ty, index + 20) * 0.07)
    c.fillRect(px + hash(tx, ty, index) * (s - size), py + hash(tx, ty, index + 10) * (s - size), size, size)
  }
}

/** Paints one tile's surface into a square of side `s` at px,py. Called only when a chunk is rebuilt. */
export function paintTile(c: Ctx, kind: TileKind, px: number, py: number, s: number, tx: number, ty: number): void {
  c.save()
  c.beginPath()
  c.rect(px, py, s, s)
  c.clip()
  PAINTERS[kind]?.(c, px, py, s, tx, ty)
  c.restore()
}

const PAINTERS: Partial<Record<TileKind, (c: Ctx, px: number, py: number, s: number, tx: number, ty: number) => void>> = {
  dirt(c, px, py, s, tx, ty) {
    c.fillStyle = shade('#5b412b', (hash(tx, ty, 1) - 0.5) * 0.14)
    c.fillRect(px, py, s, s)
    speckle(c, px, py, s, tx, ty, 6, 'rgba(0,0,0,0.22)', 'rgba(255,220,170,0.10)')
  },
  brick(c, px, py, s, tx, ty) {
    c.fillStyle = '#3a2824'
    c.fillRect(px, py, s, s)
    const gap = s * 0.05
    for (let row = 0; row < 2; row += 1) {
      const course = ty * 2 + row
      const offset = course % 2 === 0 ? 0 : s / 4
      for (let brick = -1; brick < 2; brick += 1) {
        const column = tx * 2 + brick + (course % 2)
        c.fillStyle = shade('#96503f', (hash(column, course, 3) - 0.5) * 0.3)
        c.fillRect(px + brick * (s / 2) + offset + gap / 2, py + row * (s / 2) + gap / 2, s / 2 - gap, s / 2 - gap)
      }
    }
  },
  concrete(c, px, py, s, tx, ty) {
    c.fillStyle = shade('#858b93', (hash(tx, ty, 1) - 0.5) * 0.08)
    c.fillRect(px, py, s, s)
    speckle(c, px, py, s, tx, ty, 5, 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.10)')
    if (tx % 3 === 0) {
      c.fillStyle = 'rgba(0,0,0,0.22)'
      c.fillRect(px, py, s * 0.04, s)
    }
  },
  steel(c, px, py, s, tx, ty) {
    const sheen = c.createLinearGradient(px, py, px, py + s)
    sheen.addColorStop(0, '#66717f')
    sheen.addColorStop(0.5, '#4a5461')
    sheen.addColorStop(1, '#39414c')
    c.fillStyle = sheen
    c.fillRect(px, py, s, s)
    c.strokeStyle = 'rgba(0,0,0,0.35)'
    c.lineWidth = s * 0.05
    c.strokeRect(px, py, s, s)
    c.fillStyle = 'rgba(210,220,235,0.55)'
    for (const [dx, dy] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]]) {
      c.beginPath()
      c.arc(px + dx * s, py + dy * s, s * 0.045, 0, Math.PI * 2)
      c.fill()
    }
    void tx, ty
  },
  wood(c, px, py, s, tx, ty) {
    for (let plank = 0; plank < 3; plank += 1) {
      c.fillStyle = shade('#9a6b38', (hash(tx, ty * 3 + plank, 2) - 0.5) * 0.25)
      c.fillRect(px, py + (plank * s) / 3, s, s / 3 - s * 0.03)
    }
  },
  glass(c, px, py, s) {
    c.fillStyle = 'rgba(140,205,235,0.30)'
    c.fillRect(px, py, s, s)
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.beginPath()
    c.moveTo(px + s * 0.15, py + s)
    c.lineTo(px + s * 0.55, py)
    c.lineTo(px + s * 0.7, py)
    c.lineTo(px + s * 0.3, py + s)
    c.fill()
    c.fillStyle = 'rgba(220,240,250,0.6)'
    c.fillRect(px, py, s * 0.06, s)
    c.fillRect(px + s * 0.94, py, s * 0.06, s)
  },
  door(c, px, py, s) {
    const panel = c.createLinearGradient(px, py, px + s, py)
    panel.addColorStop(0, '#6f4a24')
    panel.addColorStop(0.5, '#96672f')
    panel.addColorStop(1, '#5d3d1d')
    c.fillStyle = panel
    c.fillRect(px, py, s, s)
    c.strokeStyle = 'rgba(0,0,0,0.4)'
    c.lineWidth = s * 0.05
    c.strokeRect(px + s * 0.18, py + s * 0.12, s * 0.64, s * 0.76)
    c.fillStyle = '#e8c96a'
    c.fillRect(px + s * 0.7, py + s * 0.45, s * 0.12, s * 0.1)
  },
  ladder(c, px, py, s) {
    c.fillStyle = '#7d8793'
    c.fillRect(px + s * 0.14, py, s * 0.1, s)
    c.fillRect(px + s * 0.76, py, s * 0.1, s)
    c.fillStyle = '#aab3be'
    c.fillRect(px + s * 0.14, py + s * 0.2, s * 0.72, s * 0.09)
    c.fillRect(px + s * 0.14, py + s * 0.68, s * 0.72, s * 0.09)
  },
  water(c, px, py, s) {
    const depth = c.createLinearGradient(px, py, px, py + s)
    depth.addColorStop(0, 'rgba(70,150,160,0.55)')
    depth.addColorStop(1, 'rgba(20,70,90,0.75)')
    c.fillStyle = depth
    c.fillRect(px, py + s * 0.15, s, s * 0.85)
    c.fillStyle = 'rgba(190,240,235,0.5)'
    c.fillRect(px, py + s * 0.15, s, s * 0.05)
  },
  reinforced(c, px, py, s, tx, ty) {
    c.fillStyle = shade('#6f747c', (hash(tx, ty, 1) - 0.5) * 0.06)
    c.fillRect(px, py, s, s)
  },
  fence(c, px, py, s) {
    c.strokeStyle = 'rgba(170,180,195,0.7)'
    c.lineWidth = s * 0.04
    c.beginPath()
    c.moveTo(px, py)
    c.lineTo(px + s, py + s)
    c.moveTo(px + s, py)
    c.lineTo(px, py + s)
    c.stroke()
  },
  duct(c, px, py, s) {
    c.fillStyle = '#7d8793'
    c.fillRect(px, py, s, s * 0.3)
  },
  bedrock(c, px, py, s, tx, ty) {
    c.fillStyle = shade('#1b1e24', (hash(tx, ty, 1) - 0.5) * 0.3)
    c.fillRect(px, py, s, s)
    speckle(c, px, py, s, tx, ty, 4, 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.05)')
  },
}

/** Cracks and darkening for a tile that has taken damage. `health` runs from 0 to 1. */
export function paintDamage(c: Ctx, px: number, py: number, s: number, tx: number, ty: number, health: number): void {
  c.fillStyle = `rgba(0,0,0,${(1 - health) * 0.4})`
  c.fillRect(px, py, s, s)
  c.strokeStyle = 'rgba(0,0,0,0.65)'
  c.lineWidth = s * 0.04
  const cracks = Math.ceil((1 - health) * 4)
  for (let index = 0; index < cracks; index += 1) {
    c.beginPath()
    c.moveTo(px + hash(tx, ty, index + 60) * s, py + hash(tx, ty, index + 61) * s)
    c.lineTo(px + hash(tx, ty, index + 62) * s, py + hash(tx, ty, index + 63) * s)
    c.lineTo(px + hash(tx, ty, index + 64) * s, py + hash(tx, ty, index + 65) * s)
    c.stroke()
  }
}

/** Back wall behind open space: wallpapered room or packed earth. */
export function paintBackWall(c: Ctx, kind: 'room' | 'earth', px: number, py: number, s: number, tx: number, ty: number): void {
  if (kind === 'earth') {
    c.fillStyle = shade('#2a1f18', (hash(tx, ty, 7) - 0.5) * 0.2)
    c.fillRect(px, py, s + 1, s + 1)
    speckle(c, px, py, s, tx, ty, 3, 'rgba(0,0,0,0.25)', 'rgba(255,220,170,0.05)')
    return
  }
  c.fillStyle = shade('#3b475c', (hash(tx, ty, 7) - 0.5) * 0.06)
  c.fillRect(px, py, s + 1, s + 1)
  if (tx % 4 === 0) {
    c.fillStyle = 'rgba(0,0,0,0.16)'
    c.fillRect(px, py, s * 0.06, s + 1)
  }
}
