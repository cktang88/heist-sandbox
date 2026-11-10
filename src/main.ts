import { createAudio } from './audio'
import type { Input } from './game/input'
import { stepWorld } from './game/step'
import { TOOLS } from './game/toolDefs'
import { centerOf } from './game/types'
import { createWorld, type World } from './game/world'
import { attachInput } from './inputDevice'
import { createCamera, followFocus } from './render/camera'
import { drawHud } from './render/drawHud'
import { drawOverlay } from './render/overlay'
import { createRenderer3d } from './render3d/renderer3d'

const MAX_FRAME_SECONDS = 1 / 30

const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const context = canvas.getContext('2d')!
const input = attachInput(canvas, TOOLS.length)
const scene = createRenderer3d(stage)
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
  scene.resize(canvas.width, canvas.height)
}
window.addEventListener('resize', resize)
resize()

function fastForward(target: World, seconds: number, held: Input): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) stepWorld(target, { ...held, firePressed: held.fire, jumpPressed: false, interactPressed: false, detonatePressed: false, reloadPressed: false, selectTool: null }, 1 / 60)
}

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
  scene.draw(world, camera, frameInput.aim)
  context.clearRect(0, 0, canvas.width, canvas.height)
  drawOverlay(context, world, camera)
  drawHud(context, world, camera, frameInput.aim)
  // Debug hook: lets tests and the console inspect the heist and fast-forward it.
  ;(globalThis as { __game?: unknown }).__game = { world, advance: (seconds: number, held: Partial<Input> = {}) => fastForward(world, seconds, { ...frameInput, ...held }) }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
