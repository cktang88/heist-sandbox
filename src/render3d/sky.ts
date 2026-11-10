import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { cellHash } from './noise'

const WIDTH = 4096
const HEIGHT = 1024

/** A far-off night city painted once onto a big backdrop. Perspective makes it drift slower than the level. */
export function createSky(levelWidth: number, groundY: number): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const c = canvas.getContext('2d')!

  const fade = c.createLinearGradient(0, 0, 0, HEIGHT)
  fade.addColorStop(0, '#03050c')
  fade.addColorStop(0.55, '#0b1226')
  fade.addColorStop(0.8, '#1c2038')
  fade.addColorStop(1, '#2a2536')
  c.fillStyle = fade
  c.fillRect(0, 0, WIDTH, HEIGHT)

  for (let star = 0; star < 500; star += 1) {
    c.fillStyle = `rgba(255,255,255,${0.15 + cellHash(star, 1, 5) * 0.6})`
    const size = 1 + cellHash(star, 2, 5) * 1.5
    c.fillRect(cellHash(star, 3, 5) * WIDTH, cellHash(star, 4, 5) * HEIGHT * 0.6, size, size)
  }

  const moon = { x: WIDTH * 0.7, y: HEIGHT * 0.22 }
  const halo = c.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, 320)
  halo.addColorStop(0, 'rgba(190,205,255,0.35)')
  halo.addColorStop(1, 'rgba(190,205,255,0)')
  c.fillStyle = halo
  c.fillRect(0, 0, WIDTH, HEIGHT)
  c.fillStyle = '#e6ebf7'
  c.beginPath()
  c.arc(moon.x, moon.y, 38, 0, Math.PI * 2)
  c.fill()

  // Low cloud lit from below by the city.
  for (let cloud = 0; cloud < 26; cloud += 1) {
    const x = cellHash(cloud, 1, 9) * WIDTH
    const y = HEIGHT * (0.35 + cellHash(cloud, 2, 9) * 0.3)
    const puff = c.createRadialGradient(x, y, 0, x, y, 260)
    puff.addColorStop(0, 'rgba(70,74,104,0.22)')
    puff.addColorStop(1, 'rgba(70,74,104,0)')
    c.fillStyle = puff
    c.fillRect(x - 260, y - 120, 520, 240)
  }

  paintSkyline(c, 1, '#141a2e', 0.5, 0.42)
  paintSkyline(c, 2, '#0b0f1c', 0.75, 0.3)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const width = levelWidth * 2.4
  const sky = new Mesh(new PlaneGeometry(width, width * (HEIGHT / WIDTH)), new MeshBasicMaterial({ map: texture, fog: false, toneMapped: true }))
  sky.position.set(levelWidth / 2, -groundY + width * (HEIGHT / WIDTH) * 0.5 - 6, -70)
  return sky
}

function paintSkyline(c: CanvasRenderingContext2D, seed: number, color: string, windowChance: number, tallest: number): void {
  let x = 0
  for (let building = 0; x < WIDTH; building += 1) {
    const width = 50 + cellHash(building, seed, 1) * 120
    const height = HEIGHT * (0.12 + cellHash(building, seed, 2) * tallest)
    c.fillStyle = color
    c.fillRect(x, HEIGHT - height, width, height)
    for (let wy = HEIGHT - height + 12; wy < HEIGHT - 8; wy += 15) {
      for (let wx = x + 7; wx < x + width - 9; wx += 13) {
        if (cellHash(Math.round(wx), Math.round(wy), seed) > windowChance * 0.42) continue
        c.fillStyle = cellHash(Math.round(wx), Math.round(wy), seed + 9) < 0.78 ? 'rgba(255,190,110,0.8)' : 'rgba(170,210,255,0.75)'
        c.fillRect(wx, wy, 6, 8)
      }
    }
    x += width + cellHash(building, seed, 3) * 12
  }
}
