import { createAudio } from './audio'
import { stepWorld } from './game/step'
import { TOOLS } from './game/toolDefs'
import { centerOf } from './game/types'
import { createWorld, type World } from './game/world'
import { attachInput } from './inputDevice'
import { createCamera, followFocus } from './render/camera'
import { drawHud } from './render/drawHud'
import { createSceneRenderer } from './render/drawScene'

const MAX_FRAME_SECONDS = 1 / 30

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const context = canvas.getContext('2d')!
const input = attachInput(canvas, TOOLS.length)
const scene = createSceneRenderer()
const audio = createAudio()

function newSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 1e9)
}

let world: World = createWorld(newSeed())
let lastTime = performance.now()
let view = centerOf(world.player)
let aim = view

function resize(): void {
  // Draw at the screen's real pixel density so edges stay sharp.
  const density = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(window.innerWidth * density)
  canvas.height = Math.round(window.innerHeight * density)
}
window.addEventListener('resize', resize)
resize()

function frame(now: number): void {
  const realDt = Math.min(MAX_FRAME_SECONDS, (now - lastTime) / 1000)
  lastTime = now

  view = followFocus(view, centerOf(world.drone ?? world.player), aim, realDt)
  const camera = createCamera(canvas.width, canvas.height, view, world.grid)
  const frameInput = input.read(camera)
  aim = frameInput.aim
  if (world.status !== 'playing' && input.consumeRestart()) {
    world = createWorld(Math.floor(Math.random() * 1e9))
    view = centerOf(world.player)
  } else input.consumeRestart()

  stepWorld(world, frameInput, realDt)
  audio.update(world)
  scene.draw(context, world, camera, frameInput.aim)
  drawHud(context, world, camera, frameInput.aim)
  ;(globalThis as { __game?: { world: World } }).__game = { world }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
