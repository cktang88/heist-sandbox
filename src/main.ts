// Must stay first: writes the stored settings into the address before anything reads it.
import './ui/boot'
import { createAudio } from './audio'
import type { Input } from './game/input'
import { stepWorld } from './game/step'
import { HOTKEYS } from './game/toolDefs'
import { centerOf } from './game/types'
import { createWorld, type SiteKind, type World } from './game/world'
import { attachInput } from './inputDevice'
import { createCamera, followFocus } from './render/camera'
import { drawHud } from './render/drawHud'
import { drawFlashOverlay } from './render/flashOverlay'
import { drawOverlay } from './render/overlay'
import { createSceneRenderer, type SceneRenderer } from './render/drawScene'
import { createRenderer3d, type Renderer3d } from './render3d/renderer3d'
import { randomSeed, writeSeed } from './ui/address'
import { createMenus } from './ui/menus'

const MAX_FRAME_SECONDS = 1 / 30

const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const context = canvas.getContext('2d')!
const input = attachInput(canvas, HOTKEYS)
/**
 * The flat 2D view remains as a fallback: add `?render=2d` to the address, or it is used if 3D cannot start.
 * `?quality=low` keeps 3D but drops shadows and sharpness.
 */
function createScene(): { draw3d: Renderer3d | null; draw2d: SceneRenderer | null } {
  const options = new URLSearchParams(location.search)
  if (options.get('render') !== '2d') {
    try {
      return { draw3d: createRenderer3d(stage, options.get('quality') === 'low'), draw2d: null }
    } catch (error) {
      console.warn('3D view unavailable, using the 2D view instead', error)
    }
  }
  stage.style.display = 'none'
  return { draw3d: null, draw2d: createSceneRenderer() }
}
const scene = createScene()
const audio = createAudio()

function newSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 1e9)
}

/** The full complex by default; add `?site=outpost` for the small single building. */
const siteKind: SiteKind = new URLSearchParams(location.search).get('site') === 'outpost' ? 'outpost' : 'complex'
let world: World = createWorld(newSeed(), siteKind)
let lastTime = performance.now()
let view = centerOf(world.player)
let aim = view

// Menus (src/ui): pause, controls, help and settings. While one is open the heist does not step.
function startHeist(seed: number): void {
  writeSeed(seed)
  world = createWorld(seed, siteKind)
  view = centerOf(world.player)
}
const menus = createMenus({ audio, site: siteKind, newHeist: startHeist })

function resize(): void {
  // Draw at the screen's real pixel density so edges stay sharp.
  const density = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(window.innerWidth * density)
  canvas.height = Math.round(window.innerHeight * density)
  scene.draw3d?.resize(canvas.width, canvas.height)
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
    startHeist(randomSeed())
  } else input.consumeRestart()

  if (!menus.paused()) {
    stepWorld(world, frameInput, realDt)
    menus.afterStep(world)
  }
  audio.update(world)
  if (scene.draw3d) {
    scene.draw3d.draw(world, camera, frameInput.aim)
    context.clearRect(0, 0, canvas.width, canvas.height)
    drawOverlay(context, world, camera)
  } else scene.draw2d?.draw(context, world, camera, frameInput.aim)
  drawFlashOverlay(context, world, canvas.width, canvas.height)
  drawHud(context, world, camera, frameInput.aim)
  // Debug hook: lets tests and the console inspect the heist and fast-forward it.
  ;(globalThis as { __game?: unknown }).__game = { world, advance: (seconds: number, held: Partial<Input> = {}) => fastForward(world, seconds, { ...frameInput, ...held }) }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
