import type { Camera } from './camera'
import { hash } from './tileArt'

const DROPS = 140
const FALL_SPEED = 1.4
const SLANT = 0.22

/**
 * Rain across the open sky. It runs on game time, so in slow motion the drops hang in the air.
 * Drawn behind the level, so it never shows indoors.
 */
export function drawRain(context: CanvasRenderingContext2D, camera: Camera, gameClock: number): void {
  const { width, height } = camera
  const length = height * 0.045
  context.strokeStyle = 'rgba(170,195,230,0.28)'
  context.lineWidth = Math.max(1, height / 600)
  context.beginPath()
  for (let drop = 0; drop < DROPS; drop += 1) {
    const speed = FALL_SPEED * (0.7 + hash(drop, 1, 11) * 0.6)
    const fall = (hash(drop, 2, 11) + gameClock * speed) % 1
    // Sliding with the camera makes the rain feel like part of the world, not the screen.
    const x = (((hash(drop, 3, 11) * width - camera.x * camera.scale * 0.5 - fall * height * SLANT) % width) + width) % width
    const y = fall * (height + length) - length
    context.moveTo(x, y)
    context.lineTo(x - length * SLANT, y + length)
  }
  context.stroke()
}
