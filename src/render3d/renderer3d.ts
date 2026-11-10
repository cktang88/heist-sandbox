import { DoubleSide, Group, Mesh, MeshBasicMaterial, PCFShadowMap, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
// First, so its material hook is in place before any module below creates a material with its own hook.
import { setSurfaceStyle } from './style/materialStyle'
import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { Camera } from '../render/camera'
import { createActors, type Actors } from './actors'
import { clearBuildJobs, isLoading } from './core/buildQueue'
import { holdBackFarChunks } from './core/chunkBudget'
import { compileScene, uploadTextures } from './core/gpu'
import { createEnvironment } from './core/environment'
import { lookFor } from './core/looks'
import { createQualityController, LADDER, LOW_DETAIL } from './core/quality'
import { createRenderInfo } from './core/renderInfo'
import { measured, timedPart } from './core/timing'
import { createSkyShading, type SkyShading } from './core/skyShading'
import { createLevelMesh, FRONT, type LevelMesh } from './levelMesh'
import { createLights } from './lights'
import { createSurfaceMaterials, setWetness } from './materials'
import { createPost, type PostChain } from './post'
import { setPeopleOutdoorFill } from './people/surface'
import { createSky, setSkyStyle } from './sky'
import { createCameraRig, TILES_TALL } from './style/cameraRig'
import { pixelGrid, type PixelGrid } from './style/pixelGrid'
import { STYLES, styleFromQuery, type Style, type StyleName } from './style/styles'

const MAX_SHAKE_TILES = 0.4
/** Very large or high-density screens are drawn at no more than about this many pixels, then stretched. */
const MAX_PIXELS = 1920 * 1200
/** Longest wait for shaders and the sky before drawing a new level anyway. */
const WARM_UP_LIMIT_MS = 4000

export type Renderer3d = {
  draw(world: World, camera: Camera, aim: Vec): void
  resize(width: number, height: number): void
  /** Switches the art style live, without reloading: rebuilds the post chain; no material shader is recompiled. */
  setLook(name: StyleName): void
}

/**
 * `lowDetail` pins the cheapest quality rung (no shadows, occlusion or multisampling, reduced resolution).
 * Otherwise the quality ladder adapts to the frame rate; `?quality=high` pins the top rung instead.
 * `?look=` picks the art style (see style/styles.ts). `?debug=1` publishes renderer counters on
 * `globalThis.__renderInfo` and a `globalThis.__setLook(name)` switch for side-by-side comparisons.
 */
export function createRenderer3d(canvas: HTMLCanvasElement, lowDetail = false): Renderer3d {
  const options = new URLSearchParams(location.search)
  const pinnedHigh = options.get('quality') === 'high'
  // Antialiasing happens in the post chain: canvas multisampling would be lost in the composer.
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.type = PCFShadowMap
  // Each light decides when its own shadow map is redrawn (`light.shadow.autoUpdate` / `needsUpdate`); this stays on so it can.
  renderer.shadowMap.autoUpdate = true
  // Counters cover every pass of a frame, not just the last one.
  renderer.info.autoReset = false

  const scene = new Scene()
  const environment = createEnvironment(renderer, scene)
  const cameras = createCameraRig()
  const lights = createLights()
  lights.group.name = 'lights'
  scene.add(lights.group)
  const materials = createSurfaceMaterials(renderer.capabilities.getMaxAnisotropy())
  let style: Style = styleFromQuery(location.search)
  let post: PostChain = createPost(renderer, scene, cameras, style)
  setSurfaceStyle(style.surface)
  const quality = createQualityController(lowDetail ? LOW_DETAIL : 0, lowDetail || pinnedHigh)
  const info = createRenderInfo(renderer, options.get('debug') === '1')

  let grid: Grid | null = null
  let stage: { level: LevelMesh; actors: Actors; group: Group; sky: SkyShading; backdrop: Group } | null = null
  let warming: Promise<unknown> | null = null
  let building: Generator<void, void> | null = null
  let drawnThisLevel = false
  let screen = { width: 1, height: 1 }
  let appliedLevel = -1
  let lastFrame = performance.now()
  let artGrid: PixelGrid | null = null
  applyQuality(quality.level)
  if (options.get('debug') === '1') (globalThis as { __setLook?: (name: StyleName) => void }).__setLook = setStyle

  function setStyle(name: StyleName): void {
    post.dispose()
    style = STYLES[name]
    if (stage) setSkyStyle(stage.backdrop, style)
    // The cameras' clip planes depend on the look, and the new passes read them when built.
    fitCameras()
    post = createPost(renderer, scene, cameras, style)
    setSurfaceStyle(style.surface)
    post.setQuality(LADDER[appliedLevel])
    applySize(LADDER[appliedLevel].scale)
  }

  function applyQuality(levelIndex: number): void {
    if (levelIndex === appliedLevel) return
    appliedLevel = levelIndex
    const level = LADDER[levelIndex]
    renderer.shadowMap.enabled = level.shadows
    post.setQuality(level)
    applySize(level.scale)
  }

  function fitCameras(): void {
    artGrid = style.finish.kind === 'pixel' ? pixelGrid(screen.width, screen.height, style.finish.artHeight, TILES_TALL) : null
    cameras.resize(screen.width / screen.height, artGrid)
  }

  function applySize(scale: number): void {
    renderer.setPixelRatio(1)
    fitCameras()
    if (artGrid) {
      // The art pixels are drawn small anyway; the canvas itself stays at the screen's own size, so the
      // upscale lands each art pixel on an exact block of screen pixels and nothing is stretched again.
      renderer.setSize(screen.width, screen.height, false)
      post.setSize(screen.width, screen.height, artGrid)
    } else {
      const fit = Math.min(1, Math.sqrt(MAX_PIXELS / (screen.width * screen.height)))
      const width = Math.max(1, Math.round(screen.width * fit * scale))
      const height = Math.max(1, Math.round(screen.height * fit * scale))
      renderer.setSize(width, height, false)
      post.setSize(width, height, null)
    }
  }

  /**
   * Sets up a level in steps, one per frame, so the page keeps painting the loading screen between them:
   * sky shading, level geometry, then each layer, then the shader warm-up.
   */
  function* stageSteps(world: World): Generator<void, void> {
    if (stage) {
      scene.remove(stage.group)
      stage.level.dispose()
      stage.actors.dispose()
      stage.sky.dispose()
      // The backdrop holds one large texture; free it or every new heist keeps the old one.
      stage.backdrop.userData.dispose?.()
      stage = null
    }
    // Jobs left over from an earlier level would build into a scene that is gone.
    clearBuildJobs()
    const group = new Group()
    const sky = measured('build sky shading', () => createSkyShading(world.grid))
    yield
    const level = measured('build level mesh', () => createLevelMesh(world.grid, world.interiors, world.groundY, materials))
    yield
    const actors = createActors(world, materials)
    while (!actors.buildNext()) yield
    const backdrop = createSky(world.grid.width, world.groundY, world.timeOfDay, world.lamps.length, style)
    level.group.name = 'level'
    actors.group.name = 'actors'
    backdrop.name = 'backdrop'
    group.add(level.group, actors.group, backdrop)
    // The building is drawn cut open, so invisible sheets stand in for its missing front and keep moonlight out.
    const blocker = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    for (const area of world.interiors) {
      const sheet = new Mesh(new PlaneGeometry(area.w, area.h), blocker)
      sheet.position.set(area.x + area.w / 2, -(area.y + area.h / 2), FRONT + 0.05)
      sheet.castShadow = true
      group.add(sheet)
    }
    scene.add(group)
    stage = { level, actors, group, sky, backdrop }
    uploadTextures(group, world.player)

    const look = lookFor(world.timeOfDay, world.lamps.length)
    environment.apply(look)
    sky.setIndoor(look.indoorDiffuse, look.indoorSpecular)
    setWetness(materials, look.wet ? 1 : 0)
    setPeopleOutdoorFill(world.timeOfDay)
    warming = warmUp(world, environment.ready())
  }

  /** Compiles every shader the new level needs, in parallel where the browser allows, before the first frame. */
  function warmUp(world: World, skyReady: Promise<void>): Promise<unknown> {
    const limit = new Promise((resolve) => setTimeout(resolve, WARM_UP_LIMIT_MS))
    const work = skyReady.then(() => {
      placeCamera(world, world.player)
      return measured('compile shaders', () => compileScene(renderer, scene, cameras.perspective))
    })
    const done = Promise.race([work, limit])
    void done.then(() => {
      warming = null
    })
    return done
  }

  function placeCamera(world: World, view: Vec): void {
    post.setSnap(cameras.place(view, world.shake * world.shake * MAX_SHAKE_TILES, artGrid))
  }

  return {
    draw(world, view, aim) {
      const now = performance.now()
      applyQuality(quality.frame(now - lastFrame))
      lastFrame = now
      if (grid !== world.grid) {
        grid = world.grid
        building = stageSteps(world)
        drawnThisLevel = false
      }
      if (building?.next().done === false) return
      building = null
      if (warming || !stage) return

      // Damaged chunks are re-meshed a few a frame, nearest first, so a big blast never stalls one frame.
      const later = holdBackFarChunks(world.grid, view)
      stage.sky.markChunks(world.grid.dirtyChunks)
      timedPart('level mesh', () => stage!.level.refresh(view))
      for (const index of later) world.grid.dirtyChunks.add(index)
      stage.actors.update(world, aim, view)
      timedPart('lights', () => lights.update(world, view))
      placeCamera(world, view)
      stage.sky.update(cameras.perspective.matrixWorld)
      post.setLook({ timeOfDay: world.timeOfDay, alarm: world.alarm ? 0.5 + 0.5 * Math.sin(now / 260) : 0, slow: 1 - world.time.scale })

      // Behind the loading screen one frame is drawn (it compiles what exists and hands layers the renderer); after
      // that, frames only build, which is far quicker than building and drawing a scene nobody can see.
      if (isLoading() && drawnThisLevel) return
      drawnThisLevel = true
      renderer.info.reset()
      timedPart('draw (three.js and WebGL calls)', () => post.render(now / 1000))
      info.publish(now, LADDER[quality.level].scale, quality.level, quality.averageMs)
    },
    setLook: setStyle,
    resize(width, height) {
      screen = { width, height }
      applySize(LADDER[appliedLevel].scale)
    },
  }
}
