import { CanvasTexture, Mesh, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type Group } from 'three'
import type { TimeOfDay } from '../../game/site'
import { cellHash } from '../noise'
import { cellOf, type Cell } from './art'
import { QuadBatch, type Tint } from './batch'

/**
 * The nearest band of backdrop: real boxes for the blocks across the back street, 20 to 50 tiles behind the level.
 * Being geometry rather than a painting, their sides and roofs turn with the camera, which sells the depth
 * between the playable buildings and the painted city further out.
 */

/** One facade picture covers this many tiles, so its window pattern repeats rarely. */
const FACADE_TILES = 24
/** A texel kept a flat roof colour, for the tops of the blocks. */
const ROOF_UV: [number, number] = [0.003, 0.997]

type Look = { wall: string; stain: string; dark: string; lit: readonly string[]; litOdds: number; roof: string }
const LOOK: Record<TimeOfDay, Look> = {
  night: { wall: '#141822', stain: 'rgba(0,0,0,0.35)', dark: '#07090e', lit: ['#8a6434', '#9a7448', '#a08460', '#526a8a', '#8a5438'], litOdds: 0.14, roof: '#0a0c12' },
  day: { wall: '#6e737a', stain: 'rgba(30,26,20,0.3)', dark: '#3e4650', lit: ['#4e5866', '#5a6878', '#76828e'], litOdds: 0.55, roof: '#4a4e54' },
}

function facadeTexture(time: TimeOfDay): CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const c = canvas.getContext('2d')!
  const look = LOOK[time]
  const perTile = size / FACADE_TILES
  c.fillStyle = look.wall
  c.fillRect(0, 0, size, size)
  // Rain streaks down the wall.
  for (let streak = 0; streak < 120; streak += 1) {
    c.fillStyle = look.stain
    c.fillRect(cellHash(streak, 1, 41) * size, cellHash(streak, 2, 41) * size, 2 + cellHash(streak, 3, 41) * 6, 30 + cellHash(streak, 4, 41) * 160)
  }
  // Storeys three tiles tall, windows every two tiles; whole flats tend to be lit together.
  for (let storey = 0; storey < FACADE_TILES / 3; storey += 1) {
    const y = storey * 3 * perTile
    c.fillStyle = 'rgba(0,0,0,0.25)'
    c.fillRect(0, y + 2.6 * perTile, size, 0.25 * perTile)
    for (let column = 0; column < FACADE_TILES / 2; column += 1) {
      const x = column * 2 * perTile
      const flat = cellHash(Math.floor(column / 2), storey, 43)
      const roll = cellHash(column, storey, 44)
      const lit = flat < look.litOdds && roll < 0.8
      c.fillStyle = lit ? look.lit[Math.floor(roll * 100) % look.lit.length] : look.dark
      c.fillRect(x + 0.4 * perTile, y + 0.7 * perTile, 1.2 * perTile, 1.5 * perTile)
      if (lit && roll < 0.35) {
        // Blinds part way down.
        c.fillStyle = 'rgba(40,30,20,0.5)'
        for (let slat = 0; slat < 6; slat += 1) c.fillRect(x + 0.4 * perTile, y + (0.7 + slat * 0.12) * perTile, 1.2 * perTile, 0.05 * perTile)
      }
      if (cellHash(column, storey, 45) < 0.18) {
        // An air-conditioning box under the window.
        c.fillStyle = time === 'night' ? '#2a2e36' : '#a8acb0'
        c.fillRect(x + 0.6 * perTile, y + 2.25 * perTile, 0.8 * perTile, 0.45 * perTile)
      }
    }
  }
  c.fillStyle = look.roof
  c.fillRect(0, 0, 8, 8)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 4
  return texture
}

const SIGN_WORDS = ['HOTEL', 'NOODLE', '24H', 'BAR', 'CLINIC', 'LIQUOR', 'PARKING', 'MOTEL']
const SIGN_COLOURS = ['#ff2d95', '#19e3ff', '#ffb000', '#ff3b30', '#7cff4f', '#8a5cff', '#19e3ff', '#ff2d95']

function signCell(index: number): Cell {
  return cellOf(index % 2, Math.floor(index / 2), 2, 4)
}

/** Shop and hotel signs as glowing tube lettering on dark boards, two columns of four. */
function signTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const c = canvas.getContext('2d')!
  SIGN_WORDS.forEach((word, index) => {
    const [x, y] = [(index % 2) * 512, Math.floor(index / 2) * 128]
    c.fillStyle = '#0a0b10'
    c.fillRect(x + 4, y + 4, 504, 120)
    c.strokeStyle = SIGN_COLOURS[index]
    c.lineWidth = 4
    c.strokeRect(x + 12, y + 12, 488, 104)
    c.font = 'bold 84px "DejaVu Sans", sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.shadowColor = SIGN_COLOURS[index]
    c.shadowBlur = 18
    c.fillStyle = '#ffffff'
    c.fillText(word, x + 256, y + 68, 470)
    c.shadowBlur = 0
  })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const PAINT: readonly [number, number, number][] = [[1, 1, 1], [0.95, 0.78, 0.68], [0.85, 0.85, 0.9], [0.9, 0.88, 0.8], [0.7, 0.72, 0.76]]

type Block = { x0: number; x1: number; z0: number; z1: number; top: number }

/** Lays out the blocks across the back street, deterministically, with lower ones nearer and taller ones further. */
function layOut(left: number, right: number, ground: number): Block[] {
  const blocks: Block[] = []
  for (const [row, front, depth, low, high] of [[0, -28, 9, 3, 10], [1, -52, 12, 6, 18]] as const) {
    let x = left
    for (let index = 0; x < right; index += 1) {
      const width = 9 + cellHash(index, row, 61) * 16
      const gap = cellHash(index, row, 62) < 0.25 ? 3 + cellHash(index, row, 63) * 5 : 0.4
      const height = low + cellHash(index, row, 64) * (high - low)
      const setBack = cellHash(index, row, 65) * 4
      blocks.push({ x0: x, x1: x + width, z0: front - setBack - depth, z1: front - setBack, top: ground + height })
      x += width + gap
    }
  }
  return blocks
}

/** Builds the near backdrop into `group`: one mesh of blocks, one of signs, one of rooftop lights. */
export function addNeighbours(group: Group, left: number, right: number, ground: number, time: TimeOfDay): void {
  const night = time === 'night'
  const walls = new QuadBatch()
  const signs = new QuadBatch()
  const lights = new QuadBatch()
  const base = ground - 30
  layOut(left, right, ground).forEach((block, index) => {
    const shade = (night ? 0.6 : 0.8) + cellHash(index, 1, 66) * 0.2
    // Some blocks are brick, some painted render, some grey concrete.
    const hue = PAINT[Math.floor(cellHash(index, 14, 66) * PAINT.length) % PAINT.length]
    const tint: Tint = [shade * hue[0], shade * hue[1], shade * hue[2] * (night ? 1.05 : 1)]
    const shift: [number, number] = [cellHash(index, 2, 66), cellHash(index, 3, 66)]
    walls.facing(block.x0, base, block.x1, block.top, block.z1, FACADE_TILES, tint, shift)
    walls.side(block.x0, base, block.top, block.z0, block.z1, false, FACADE_TILES, tint)
    walls.side(block.x1, base, block.top, block.z0, block.z1, true, FACADE_TILES, tint)
    const roof = ROOF_UV
    walls.quad([[block.x0, block.top, block.z1], [block.x1, block.top, block.z1], [block.x1, block.top, block.z0], [block.x0, block.top, block.z0]], [0, 1, 0], [roof, roof, roof, roof], tint)
    if (cellHash(index, 4, 66) < 0.45) {
      // A water tank or plant room on the roof.
      const [cx, w] = [block.x0 + (block.x1 - block.x0) * (0.2 + cellHash(index, 5, 66) * 0.5), 2 + cellHash(index, 6, 66) * 2]
      const tankTop = block.top + 2 + cellHash(index, 7, 66) * 2
      walls.quad([[cx, block.top, block.z0 + 5], [cx + w, block.top, block.z0 + 5], [cx + w, tankTop, block.z0 + 5], [cx, tankTop, block.z0 + 5]], [0, 0, 1], [roof, roof, roof, roof], tint)
    }
    if (cellHash(index, 8, 66) < (night ? 0.5 : 0.35)) {
      const cell = signCell(Math.floor(cellHash(index, 9, 66) * SIGN_WORDS.length) % SIGN_WORDS.length)
      const width = Math.min(block.x1 - block.x0 - 1, 6 + cellHash(index, 10, 66) * 4)
      const y = ground + 4 + cellHash(index, 11, 66) * Math.max(1, block.top - ground - 10)
      const x = block.x0 + 0.5 + cellHash(index, 12, 66) * (block.x1 - block.x0 - width - 1)
      const glow: Tint = night ? [2.2, 2.2, 2.2] : [0.75, 0.75, 0.75]
      signs.facingCell(x, y, x + width, y + width / 4, block.z1 + 0.1, cell, glow)
    }
    if (night && cellHash(index, 13, 66) < 0.5) {
      const x = block.x0 + 0.5
      lights.box(x, block.top, block.z1 - 0.6, x + 0.35, block.top + 0.35, block.z1 - 0.25, 1, [3, 0.3, 0.2])
    }
  })
  const facade = facadeTexture(time)
  for (const [batch, material] of [
    [walls, new MeshBasicMaterial({ map: facade, vertexColors: true, fog: false })],
    [signs, new MeshBasicMaterial({ map: signTexture(), vertexColors: true, fog: false, transparent: true })],
    [lights, new MeshBasicMaterial({ vertexColors: true, fog: false })],
  ] as const) {
    if (batch.isEmpty) continue
    group.add(new Mesh(batch.build(), material))
  }
}
