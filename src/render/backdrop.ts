import type { Camera } from './camera'
import { hash } from './tileArt'

/** Night sky with a moon, plus two layers of distant city that slide slower than the foreground. */
export type Backdrop = { draw(context: CanvasRenderingContext2D, camera: Camera, groundY: number): void }

const STRIP_WIDTH = 2048
const STRIP_HEIGHT = 600

export function createBackdrop(): Backdrop {
  let sky: HTMLCanvasElement | null = null
  const far = skyline(1, '#161c33', 0.35, 28)
  const near = skyline(2, '#0f1426', 0.6, 20)

  return {
    draw(context, camera, groundY) {
      if (!sky || sky.width !== camera.width || sky.height !== camera.height) sky = paintSky(camera.width, camera.height)
      context.drawImage(sky, 0, 0)
      const horizon = camera.height / 2 + (groundY - camera.y) * camera.scale
      drawStrip(context, far, camera, horizon, 0.12)
      drawStrip(context, near, camera, horizon, 0.3)
    },
  }
}

function drawStrip(context: CanvasRenderingContext2D, strip: HTMLCanvasElement, camera: Camera, horizon: number, parallax: number): void {
  const scale = camera.height / 720
  const width = STRIP_WIDTH * scale
  const height = STRIP_HEIGHT * scale
  const offset = -((camera.x * camera.scale * parallax) % width)
  const top = camera.height * 0.5 + (horizon - camera.height * 0.5) * (0.3 + parallax) - height * 0.75
  for (let x = offset - width; x < camera.width; x += width) context.drawImage(strip, x, top, width, height)
}

function paintSky(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const c = canvas.getContext('2d')!
  const fade = c.createLinearGradient(0, 0, 0, height)
  fade.addColorStop(0, '#070b1c')
  fade.addColorStop(0.6, '#182447')
  fade.addColorStop(1, '#3a3558')
  c.fillStyle = fade
  c.fillRect(0, 0, width, height)

  for (let star = 0; star < 160; star += 1) {
    c.fillStyle = `rgba(255,255,255,${0.2 + hash(star, 1, 5) * 0.6})`
    const size = 1 + hash(star, 2, 5) * 1.6
    c.fillRect(hash(star, 3, 5) * width, hash(star, 4, 5) * height * 0.7, size, size)
  }

  const moonX = width * 0.78
  const moonY = height * 0.2
  const halo = c.createRadialGradient(moonX, moonY, 0, moonX, moonY, height * 0.35)
  halo.addColorStop(0, 'rgba(200,215,255,0.35)')
  halo.addColorStop(1, 'rgba(200,215,255,0)')
  c.fillStyle = halo
  c.fillRect(0, 0, width, height)
  c.fillStyle = '#e9edf7'
  c.beginPath()
  c.arc(moonX, moonY, height * 0.045, 0, Math.PI * 2)
  c.fill()
  return canvas
}

function skyline(seed: number, color: string, windowChance: number, minWidth: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = STRIP_WIDTH
  canvas.height = STRIP_HEIGHT
  const c = canvas.getContext('2d')!
  let x = 0
  for (let building = 0; x < STRIP_WIDTH; building += 1) {
    const width = minWidth * 2 + hash(building, seed, 1) * 110
    const height = 140 + hash(building, seed, 2) * 380
    c.fillStyle = color
    c.fillRect(x, STRIP_HEIGHT - height, width, height)
    for (let wy = STRIP_HEIGHT - height + 14; wy < STRIP_HEIGHT - 10; wy += 20) {
      for (let wx = x + 8; wx < x + width - 10; wx += 16) {
        if (hash(Math.round(wx), Math.round(wy), seed) > windowChance * 0.5) continue
        c.fillStyle = hash(Math.round(wx), Math.round(wy), seed + 9) < 0.8 ? 'rgba(255,196,110,0.75)' : 'rgba(170,210,255,0.7)'
        c.fillRect(wx, wy, 7, 9)
      }
    }
    x += width + hash(building, seed, 3) * 14
  }
  return canvas
}
