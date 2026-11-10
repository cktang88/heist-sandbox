import {
  ACESFilmicToneMapping, DoubleSide, FogExp2, Group, Mesh, MeshBasicMaterial, PCFShadowMap, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { Camera } from '../render/camera'
import { createActors, type Actors } from './actors'
import { createLevelMesh, FRONT, type LevelMesh } from './levelMesh'
import { createLights } from './lights'
import { createSurfaceMaterials } from './materials'
import { createPost } from './post'
import { createSky } from './sky'

const FIELD_OF_VIEW = 30
/** Matches the 2D camera, which shows 24 tiles top to bottom at the play plane. */
const TILES_TALL = 24
const CAMERA_DISTANCE = TILES_TALL / 2 / Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
const MAX_SHAKE_TILES = 0.4
const NIGHT_SKY_STRENGTH = 2.2

export type Renderer3d = { draw(world: World, camera: Camera, aim: Vec): void; resize(width: number, height: number): void }

/** `lowDetail` turns off shadows and draws at reduced sharpness, for machines that struggle. */
export function createRenderer3d(canvas: HTMLCanvasElement, lowDetail = false): Renderer3d {
  const renderer = new WebGLRenderer({ canvas, antialias: !lowDetail, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = !lowDetail
  renderer.shadowMap.type = PCFShadowMap

  const scene = new Scene()
  scene.fog = new FogExp2(0x0b1018, 0.0028)
  // A photographed night sky lights the scene softly and gives metal and glass something real to reflect.
  // Until it has loaded, a plain studio surround stands in.
  const surround = new PMREMGenerator(renderer)
  scene.environment = surround.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.1
  new HDRLoader().load(`${import.meta.env.BASE_URL}env/night.hdr`, (sky) => {
    scene.environment = surround.fromEquirectangular(sky).texture
    scene.environmentIntensity = NIGHT_SKY_STRENGTH
    sky.dispose()
  })

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 400)
  const lights = createLights()
  scene.add(lights.group)
  const materials = createSurfaceMaterials(renderer.capabilities.getMaxAnisotropy())
  const post = createPost(renderer, scene, camera)

  let grid: Grid | null = null
  let stage: { level: LevelMesh; actors: Actors; group: Group } | null = null

  function buildStage(world: World): void {
    if (stage) {
      scene.remove(stage.group)
      stage.level.dispose()
      stage.actors.dispose()
    }
    const group = new Group()
    const level = createLevelMesh(world.grid, world.interiors, world.groundY, materials)
    const actors = createActors(world, materials)
    group.add(level.group, actors.group, createSky(world.grid.width, world.groundY))
    // The building is drawn cut open, so invisible sheets stand in for its missing front and keep moonlight out.
    const blocker = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    for (const area of world.interiors) {
      const sheet = new Mesh(new PlaneGeometry(area.w, area.h), blocker)
      sheet.position.set(area.x + area.w / 2, -(area.y + area.h / 2), FRONT + 0.05)
      sheet.castShadow = true
      group.add(sheet)
    }
    scene.add(group)
    stage = { level, actors, group }
    grid = world.grid
  }

  return {
    draw(world, view, aim) {
      if (grid !== world.grid || !stage) buildStage(world)
      stage!.level.refresh()
      stage!.actors.update(world, aim)
      lights.update(world, view)

      const jolt = world.shake * world.shake * MAX_SHAKE_TILES
      camera.position.set(view.x + (Math.random() - 0.5) * 2 * jolt, -view.y + (Math.random() - 0.5) * 2 * jolt, CAMERA_DISTANCE)
      camera.lookAt(camera.position.x, camera.position.y, 0)
      post.render(performance.now() / 1000, 1 - world.time.scale)
    },
    resize(width, height) {
      const sharpness = lowDetail ? 0.6 : 1
      renderer.setPixelRatio(1)
      renderer.setSize(Math.round(width * sharpness), Math.round(height * sharpness), false)
      post.setSize(Math.round(width * sharpness), Math.round(height * sharpness))
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
  }
}
