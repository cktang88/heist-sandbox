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
import { buildMsSpent, setLoading } from './render3d/core/buildQueue'
import { endFrame, noteFramePart, startCountingFrames } from './render3d/core/frameProbe'
import { sceneReadiness } from './render3d/core/readiness'
import { measured } from './render3d/core/timing'
import { createRenderer3d, type Renderer3d } from './render3d/renderer3d'
import { onLookChange, randomSeed, writeSeed } from './ui/address'
import { loadingScreen, nextPaint } from './ui/loading'
import { enableStepTimings, stepTimings } from './game/stepTimings'
import { showHint } from './ui/hint'
import { createMenus } from './ui/menus'
import { rememberNemeses, withNemeses } from './ui/nemesisStore'
// Director, briefing, weather and debrief (src/game/director, src/game/chronicle, src/ui/debrief.ts).
import { startDirector } from './game/director/director'
import { debriefOf } from './game/chronicle/chronicle'
import { showBriefing } from './ui/briefing'
import { showDebrief } from './ui/debrief'
import { rememberHeist } from './ui/debriefStore'
import { createWeather } from './ui/weather'

const MAX_FRAME_SECONDS = 1 / 30

const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const context = canvas.getContext('2d')!
const input = attachInput(canvas, HOTKEYS)
const loading = loadingScreen()
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
const audio = createAudio()

function newSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 1e9)
}

/** The full complex by default; add `?site=outpost` for the small single building. */
const siteKind: SiteKind = new URLSearchParams(location.search).get('site') === 'outpost' ? 'outpost' : 'complex'

// --- Start-up: each step paints the loading screen first, so the page shows progress instead of freezing. ---
loading.show(0.02, 'Starting the renderer')
await nextPaint()
const scene = measured('create renderer', createScene)
loading.show(0.06, 'Generating the complex')
await nextPaint()
let heistSeed = newSeed()
// Guards who met the player on earlier heists come back (kept in the browser's storage).
let world: World = measured('create world', () => withNemeses(createWorld(heistSeed, siteKind)))
startDirector(world)
let lastTime = performance.now()
let view = centerOf(world.player)
let aim = view
/** Until the scene near the player is built the heist does not step; see `render3d/core/readiness.ts`. */
let starting = true
const dropJobs = { value: 0 }
let finalFrameDrawn = false
let countFramesNext = false
loading.show(0.12, 'Building the city')
await nextPaint()

function beginLoading(): void {
  starting = true
  finalFrameDrawn = false
  dropJobs.value = 0
  setLoading(true)
}

function finishLoading(now: number): void {
  starting = false
  finalFrameDrawn = false
  setLoading(false)
  loading.hide()
  // This frame still carries the last of the loading work, so worst frames are counted from the next one.
  countFramesNext = true
  if (new URLSearchParams(location.search).get('debug') === '1') console.info(`[perf] building during loading: ${buildMsSpent()} ms of script`)
  // The time spent loading is not game time.
  lastTime = now
  showBriefing(world)
  showHint()
}

/**
 * Moves the bar while the scene is being built. Once the drop path is ready, one more frame is drawn behind the
 * loading screen (it uploads everything just built), then play starts.
 */
function updateLoading(now: number): void {
  if (!scene.draw3d || finalFrameDrawn) {
    finishLoading(now)
    return
  }
  const state = sceneReadiness(world, dropJobs)
  loading.show(0.2 + state.share * 0.8, state.step)
  if (!state.ready) return
  setLoading(false)
  finalFrameDrawn = true
}

// Menus (src/ui): pause, controls, help and settings. While one is open the heist does not step.
function startHeist(seed: number): void {
  writeSeed(seed)
  loading.show(0.06, 'Generating the complex')
  world = withNemeses(createWorld(seed, siteKind))
  heistSeed = seed
  startDirector(world)
  closeDebrief()
  view = centerOf(world.player)
  beginLoading()
}

// --- The debrief: when the heist ends (won or dead), its story goes on screen and into the past-heists list. ---
const weather = createWeather()
let closeDebrief = () => {}
let debriefed: World | null = null
function debriefIfOver(): void {
  if (world.status === 'playing' || debriefed === world) return
  debriefed = world
  const entry = { debrief: debriefOf(world), seed: heistSeed, site: siteKind, when: new Date().toLocaleString() }
  rememberHeist(entry)
  closeDebrief = showDebrief(entry, { sameSeed: () => startHeist(heistSeed), newSeed: () => startHeist(randomSeed()) })
}
// `?debug=1` times each game system; read the slowest steps with `__stepTimings()` in the console.
if (new URLSearchParams(location.search).get('debug') === '1') {
  enableStepTimings(true)
  ;(globalThis as { __stepTimings?: unknown }).__stepTimings = stepTimings
}
const menus = createMenus({ audio, site: siteKind, newHeist: startHeist, world: () => world })
if (scene.draw3d) onLookChange((look) => scene.draw3d?.setLook(look))

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

/** Times one part of the frame for the frame probe (`?debug=1`, `__renderInfo.worstFrames`). */
function timed(cause: string, work: () => void): void {
  const start = performance.now()
  work()
  noteFramePart(cause, performance.now() - start)
}

function frame(now: number): void {
  const frameStart = performance.now()
  const realDt = Math.min(MAX_FRAME_SECONDS, (now - lastTime) / 1000)
  lastTime = now

  view = followFocus(view, centerOf(world.drone ?? world.player), aim, realDt)
  const camera = createCamera(canvas.width, canvas.height, view, world.grid)
  const frameInput = input.read(camera)
  aim = frameInput.aim
  if (world.status !== 'playing' && input.consumeRestart()) {
    startHeist(randomSeed())
  } else input.consumeRestart()

  if (!menus.paused() && !starting) {
    timed('simulation', () => {
      stepWorld(world, frameInput, realDt)
      rememberNemeses(world)
      menus.afterStep(world)
    })
    debriefIfOver()
  }
  weather.update(world)
  audio.update(world)
  timed('scene', () => {
    if (scene.draw3d) {
      scene.draw3d.draw(world, camera, frameInput.aim)
      context.clearRect(0, 0, canvas.width, canvas.height)
    } else scene.draw2d?.draw(context, world, camera, frameInput.aim)
    drawOverlay(context, world, camera)
  })
  timed('hud', () => {
    drawFlashOverlay(context, world, canvas.width, canvas.height)
    drawHud(context, world, camera, frameInput.aim)
  })
  if (starting) updateLoading(now)
  // Debug hook: lets tests and the console inspect the heist and fast-forward it.
  ;(globalThis as { __game?: unknown }).__game = { world, advance: (seconds: number, held: Partial<Input> = {}) => fastForward(world, seconds, { ...frameInput, ...held }) }
  endFrame(performance.now() - frameStart)
  if (countFramesNext) startCountingFrames()
  countFramesNext = false
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
