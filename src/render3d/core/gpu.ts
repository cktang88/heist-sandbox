import { BufferGeometry, HalfFloatType, Mesh, MeshBasicMaterial, Scene, WebGLRenderTarget, type Camera, type Material, type Object3D, type Texture, type WebGLProgram, type WebGLRenderer, Vector3 } from 'three'
import { addBuildJob, type StepResult } from './buildQueue'

/**
 * Lets layers prepare what they build before it is first drawn: geometry and textures uploaded and shaders compiled
 * while the object is still hidden, a slice per frame through the build queue, so none of it happens in the middle of
 * a frame of play and no single frame of loading stalls on all of it at once.
 *
 * Layers are not handed the renderer, so an empty mesh that is always drawn (it has no triangles, so it costs one
 * skipped call) picks up the renderer, scene and camera in its `onBeforeRender` on every frame.
 */
type Target = { renderer: WebGLRenderer; scene: Scene; camera: Camera }

let target: Target | null = null
/**
 * The scene is always drawn into the post chain's linear half-float buffer, never straight to the canvas, and a shader
 * built for the canvas (tone mapped, sRGB output) is a different program. So warm-up compiles and draws go here.
 */
const sceneLikeTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType })

/** Runs `work` with the renderer pointed at a buffer like the post chain's, so the shaders it builds are the real ones. */
export function asSceneDraw<T>(renderer: WebGLRenderer, work: () => T): T {
  const previous = renderer.getRenderTarget()
  renderer.setRenderTarget(sceneLikeTarget)
  try {
    return work()
  } finally {
    renderer.setRenderTarget(previous)
  }
}

/** One per level: until the new level's first frame is drawn, nothing counts as ready. */
export function createGpuProbe(): Mesh {
  target = null
  const probe = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
  probe.frustumCulled = false
  probe.onBeforeRender = (renderer, scene, camera) => {
    if (scene.isScene) target = { renderer, scene: scene as Scene, camera }
  }
  return probe
}

/** The renderer, once the first frame has been drawn (null before), for work that must draw off screen. */
export function currentRenderer(): WebGLRenderer | null {
  return target?.renderer ?? null
}

/** True once the renderer has been seen (after the first drawn frame). */
export function gpuReady(): boolean {
  return target !== null
}

/** Meshes whose buffers are uploaded per step: a few hundred kilobytes, well under a millisecond on a real GPU. */
const MESHES_PER_STEP = 24
/** Drawing a stand-in of each mesh into a one-pixel buffer uploads its buffers; this material makes it cost nothing. */
const UPLOADER = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
const uploadScene = new Scene()
uploadScene.overrideMaterial = UPLOADER
const uploadedTextures = new WeakSet<Texture>()

/** Frees a texture's GPU copy; three sends it again if anything draws with it later, and so does the next upload job. */
export function releaseTexture(texture: Texture): void {
  uploadedTextures.delete(texture)
  texture.dispose()
}

export function texturesOf(material: Material): Texture[] {
  return Object.values(material).filter((value): value is Texture => (value as Texture | null)?.isTexture === true)
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

/** Uploads the textures and buffers of `meshes` now, so their first real draw has nothing left to send. */
function upload(renderer: WebGLRenderer, camera: Camera, meshes: Mesh[]): void {
  for (const mesh of meshes) {
    for (const material of materialsOf(mesh)) {
      for (const texture of texturesOf(material)) {
        // A texture whose image has not arrived yet uploads itself when it does.
        if (uploadedTextures.has(texture) || texture.version === 0) continue
        uploadedTextures.add(texture)
        renderer.initTexture(texture)
      }
    }
    const standIn = new Mesh(mesh.geometry, UPLOADER)
    standIn.frustumCulled = false
    uploadScene.add(standIn)
  }
  asSceneDraw(renderer, () => renderer.render(uploadScene, camera))
  uploadScene.clear()
}

type ProgramState = { currentProgram?: WebGLProgram & { isReady?: () => boolean } }

/** Milliseconds per frame spent linking the level's shaders while the loading screen is up. */
const LINK_BUDGET_MS = 40
let linking = { done: 0, total: 0 }

/** How many of the level's shaders are ready, for the loading bar. */
export function shaderProgress(): { done: number; total: number } {
  return linking
}

function programsOf(renderer: WebGLRenderer, materials: Iterable<Material>): (WebGLProgram & { isReady?: () => boolean })[] {
  const programs = [...materials].map((material) => (renderer.properties.get(material) as ProgramState).currentProgram)
  return [...new Set(programs.filter((program) => program !== undefined))]
}

/**
 * Compiles every shader `scene` needs and settles once all are linked. Where the browser compiles in the background
 * this only waits; where it cannot, linking is where the time goes, so programs are linked a few per frame and the
 * loading screen keeps painting and counting, instead of the first frame of the level stalling for all of them.
 */
export function compileScene(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
  const programs = programsOf(renderer, asSceneDraw(renderer, () => renderer.compile(scene, camera)))
  linking = { done: 0, total: programs.length }
  return new Promise((resolve) => {
    const next = () => {
      const start = performance.now()
      while (programs.length > 0 && performance.now() - start < LINK_BUDGET_MS) {
        const ready = programs.findIndex((program) => program.isReady?.() !== false)
        if (ready < 0) break
        programs.splice(ready, 1)[0].getUniforms()
        linking.done += 1
      }
      if (programs.length === 0) resolve()
      else requestAnimationFrame(next)
    }
    next()
  })
}

/** Where a prepare job is and what it reports to the frame probe. */
export type JobArea = { x: number; y: number; halfW?: number; halfH?: number; cause: string }

/**
 * Prepares `object` in steps through the build queue: uploads its meshes' buffers and textures a slice at a time,
 * compiles its shaders for the real scene's lights, links each new program in a step of its own (where the browser
 * cannot compile in the background, linking is where the wait is), then calls `done`, which typically shows it.
 */
export function prepareJob(object: Object3D, area: JobArea, done: () => void): void {
  let meshes: Mesh[] | null = null
  let programs: (WebGLProgram & { isReady?: () => boolean })[] | null = null
  let phase = 'upload'
  addBuildJob({
    ...area,
    get cause() {
      return `${area.cause} ${phase}`
    },
    step(): StepResult {
      if (!target) return 'waiting'
      const { renderer, scene, camera } = target
      if (!meshes) {
        meshes = []
        object.traverse((child) => {
          if ((child as Mesh).isMesh) meshes!.push(child as Mesh)
        })
      }
      if (meshes.length > 0) {
        phase = 'upload'
        upload(renderer, camera, meshes.splice(0, MESHES_PER_STEP))
        return 'more'
      }
      phase = programs ? 'link' : 'compile'
      if (!programs) {
        programs = programsOf(renderer, asSceneDraw(renderer, () => renderer.compile(object, camera, scene)))
        return 'more'
      }
      // With background compiling, wait until a program says it is ready; then its first use costs nothing.
      const program = programs.find((candidate) => candidate.isReady?.() !== false)
      if (program) {
        program.getUniforms()
        programs.splice(programs.indexOf(program), 1)
        return 'more'
      }
      if (programs.length > 0) return 'waiting'
      done()
      return 'done'
    },
  })
}

/**
 * Uploads every texture used anywhere under `root`, one per step, as a job at `at`. Decoding and sending a large
 * photo texture takes long enough to be felt, so the level's shared surface textures go while the loading screen is up
 * rather than when the first wall that uses them is prepared.
 */
export function uploadTextures(root: Object3D, at: { x: number; y: number }): void {
  const textures = new Set<Texture>()
  root.traverse((child) => {
    if ((child as Mesh).isMesh) for (const material of materialsOf(child as Mesh)) for (const texture of texturesOf(material)) textures.add(texture)
  })
  const queue = [...textures]
  addBuildJob({
    ...at,
    cause: 'upload textures',
    step() {
      if (!target) return 'waiting'
      const texture = queue.pop()
      if (texture && !uploadedTextures.has(texture) && texture.version > 0) {
        uploadedTextures.add(texture)
        target.renderer.initTexture(texture)
      }
      return queue.length > 0 ? 'more' : 'done'
    },
  })
}

/** Size of the patches `uploadSpread` cuts a layer into, in tiles. */
const PATCH_W = 48
const PATCH_H = 36

/**
 * Uploads the buffers and textures of everything already in `root` (a layer built in one go, whose shaders the
 * level's warm-up compiled), patch by patch through the build queue, nearest the view first, so nothing is sent to
 * the GPU at first sight during play and no single frame sends it all.
 */
export function uploadSpread(root: Object3D, cause: string): void {
  root.updateMatrixWorld(true)
  const patches = new Map<string, { x: number; y: number; meshes: Mesh[] }>()
  const at = new Vector3()
  root.traverse((child) => {
    if (!(child as Mesh).isMesh) return
    child.getWorldPosition(at)
    const [column, row] = [Math.floor(at.x / PATCH_W), Math.floor(-at.y / PATCH_H)]
    const key = `${column},${row}`
    const patch = patches.get(key) ?? patches.set(key, { x: (column + 0.5) * PATCH_W, y: (row + 0.5) * PATCH_H, meshes: [] }).get(key)!
    patch.meshes.push(child as Mesh)
  })
  for (const { x, y, meshes } of patches.values()) {
    addBuildJob({
      x, y, halfW: PATCH_W / 2, halfH: PATCH_H / 2, cause,
      step() {
        if (!target) return 'waiting'
        upload(target.renderer, target.camera, meshes.splice(0, MESHES_PER_STEP))
        return meshes.length > 0 ? 'more' : 'done'
      },
    })
  }
}
