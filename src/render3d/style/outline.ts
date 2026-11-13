import {
  BoxGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, NearestFilter, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget,
  type Camera, type Material, type Object3D, type WebGLRenderer,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import type { OutlineTarget } from '../../game/hover'
import type { Vec } from '../../game/types'
import { BACK } from '../levelMesh'
import type { PixelGrid, Snap } from './pixelGrid'

/**
 * The yellow outline round the interactive thing under the cursor (or the one E would act on), drawn over the finished
 * frame in every look.
 *
 * The thing's own meshes (sharing their geometry, at their current world matrices) are drawn flat white into a small
 * mask, with the camera the look draws the building with; a full-screen pass then paints yellow wherever a pixel is
 * outside the mask but within a few pixels of it, so the line hugs the model's silhouette. Things drawn as tiles (doors,
 * windows) get a thin box over their tiles instead. In the pixel look the mask is drawn on the art-pixel grid and read
 * back the way the pixel finish reads the scene, so the line is one art pixel wide and moves with the picture.
 *
 * Only the outlined thing is drawn into the mask (a handful of meshes), and nothing at all happens with no target.
 */

export type OutlineView = {
  camera: Camera
  /** Canvas drawing size in pixels. */
  width: number
  height: number
  /** Pixel look only: the art grid and this frame's camera snap. */
  grid: PixelGrid | null
  snap: Snap | null
  /** 1 for the thing under the cursor, less for the one E acts on (shown a little quieter). */
  strength: number
  time: number
}

export type Outline = {
  draw(renderer: WebGLRenderer, target: OutlineTarget, model: Object3D | null, view: OutlineView): void
  dispose(): void
}

const YELLOW = new Color(1, 0.84, 0.12)
/** Line width in screen pixels at 1080 rows (smooth looks). */
const LINE_PIXELS = 3
/** Depth of the box drawn for doors and windows: about a door slab (see levelMesh). */
const TILE_DEPTH = 0.44

const OutlineShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMask;
    uniform vec2 screen;
    uniform vec2 art;
    uniform float scale;
    uniform vec2 residual;
    uniform float pixel;
    uniform float width;
    uniform float strength;
    uniform float time;
    uniform vec3 colour;
    float maskAt(vec2 at) {
      return texture2D(tMask, at / art).r;
    }
    void main() {
      // Mask coordinates of this screen pixel: the pixel finish's mapping in the pixel look, the pixel itself otherwise.
      vec2 at = residual + (gl_FragCoord.xy - screen * 0.5) / scale + art * 0.5;
      float edge = 0.0;
      float inside;
      if (pixel > 0.5) {
        vec2 cell = floor(at) + 0.5;
        inside = maskAt(cell);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398;
          edge = max(edge, maskAt(cell + vec2(floor(cos(a) + 0.5), floor(sin(a) + 0.5))));
        }
      } else {
        inside = maskAt(at);
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.392699;
          vec2 direction = vec2(cos(a), sin(a));
          edge = max(edge, maskAt(at + direction * width));
          edge = max(edge, maskAt(at + direction * width * 0.5));
        }
      }
      float pulse = 0.85 + 0.15 * sin(time * 5.0);
      // A faint wash over the thing itself, a strong line round it.
      float alpha = inside > 0.5 ? 0.1 * strength : edge * strength * pulse;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(colour, alpha);
    }`,
}

export function createOutline(): Outline {
  const scene = new Scene()
  const white = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, depthTest: false, depthWrite: false })
  const box = new BoxGeometry(1, 1, 1)
  const proxies: Mesh[] = []
  // Read back smoothly in the smooth looks, and as whole art pixels in the pixel look.
  const smoothMask = new WebGLRenderTarget(1, 1, { depthBuffer: false })
  const pixelMask = new WebGLRenderTarget(1, 1, { depthBuffer: false, magFilter: NearestFilter, minFilter: NearestFilter })
  const material = new ShaderMaterial({
    ...OutlineShader,
    uniforms: {
      tMask: { value: smoothMask.texture },
      screen: { value: new Vector2(1, 1) },
      art: { value: new Vector2(1, 1) },
      scale: { value: 1 },
      residual: { value: new Vector2() },
      pixel: { value: 0 },
      width: { value: 2 },
      strength: { value: 1 },
      time: { value: 0 },
      colour: { value: YELLOW.clone() },
    },
    transparent: true, depthTest: false, depthWrite: false,
  })
  const quad = new FullScreenQuad(material)
  const clearColour = new Color()

  function proxy(index: number): Mesh {
    let mesh = proxies[index]
    if (!mesh) {
      mesh = new Mesh(box, white)
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      proxies.push(mesh)
    }
    if (!mesh.parent) scene.add(mesh)
    return mesh
  }

  /** Puts the target's meshes (or its tile box) in the mask scene; returns how many went in. */
  function fill(target: OutlineTarget, model: Object3D | null): number {
    let count = 0
    if (model) {
      // A model kept out of the scene (a batched prop's stand-in) has nobody else updating its matrices.
      if (!model.parent) model.updateMatrixWorld(true)
      model.traverseVisible((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh || !drawsSolid(mesh.material)) return
        const stand = proxy(count++)
        stand.geometry = mesh.geometry
        stand.matrix.copy(mesh.matrixWorld)
      })
    }
    if (count > 0) return count
    // Doors, windows and anything not drawn as its own model: a box over its tiles at the walking lane.
    const stand = proxy(count++)
    stand.geometry = box
    const { x, y, w, h } = target.box
    stand.matrix.makeScale(w, h, TILE_DEPTH).setPosition(x + w / 2, -(y + h / 2), 0)
    return count
  }

  return {
    draw(renderer, target, model, view) {
      const used = fill(target, model)
      for (let index = used; index < proxies.length; index += 1) proxies[index].removeFromParent()
      scene.updateMatrixWorld()

      const grid = view.grid
      const mask = grid ? pixelMask : smoothMask
      const maskWidth = grid ? grid.width : view.width
      const maskHeight = grid ? grid.height : view.height
      if (mask.width !== maskWidth || mask.height !== maskHeight) mask.setSize(maskWidth, maskHeight)

      const previousTarget = renderer.getRenderTarget()
      const previousAlpha = renderer.getClearAlpha()
      renderer.getClearColor(clearColour)
      const previousAutoClear = renderer.autoClear
      renderer.setRenderTarget(mask)
      renderer.setClearColor(0x000000, 0)
      renderer.clear(true, false, false)
      renderer.render(scene, view.camera)

      const u = material.uniforms
      u.tMask.value = mask.texture
      u.screen.value.set(view.width, view.height)
      u.pixel.value = grid ? 1 : 0
      if (grid) {
        u.art.value.set(grid.width, grid.height)
        u.scale.value = grid.scale
        u.residual.value.set(view.snap?.residualX ?? 0, view.snap?.residualY ?? 0)
      } else {
        u.art.value.set(view.width, view.height)
        u.scale.value = 1
        u.residual.value.set(0, 0)
        u.width.value = Math.max(2, (LINE_PIXELS * view.height) / 1080)
      }
      u.strength.value = view.strength
      u.time.value = view.time % 100
      renderer.setRenderTarget(previousTarget)
      renderer.autoClear = false
      quad.render(renderer)
      renderer.autoClear = previousAutoClear
      renderer.setClearColor(clearColour, previousAlpha)
    },
    dispose() {
      smoothMask.dispose()
      pixelMask.dispose()
      material.dispose()
      quad.dispose()
      white.dispose()
      box.dispose()
    },
  }
}

/** Glows, view cones and soft shadows are see-through effects, not part of the thing's shape. */
function drawsSolid(material: Material | Material[]): boolean {
  const first = Array.isArray(material) ? material[0] : material
  if (!first || !first.visible) return false
  return !(first.transparent && (!first.depthWrite || first.opacity < 0.5))
}

const near = new Vector3()
const far = new Vector3()

/**
 * Where the cursor, given on the walking lane (z = 0, tiles, y down), meets the back wall under this camera. Under
 * perspective the back wall is drawn smaller, and the leaned orthographic camera of the pixel look draws it higher, so
 * a wall device is under the cursor somewhere else than the lane point is.
 */
export function aimOnBackWall(camera: Camera, aim: Vec): Vec {
  near.set(aim.x, -aim.y, 0).project(camera)
  far.copy(near)
  near.z = -1
  far.z = 1
  near.unproject(camera)
  far.unproject(camera)
  const span = far.z - near.z
  if (Math.abs(span) < 1e-6) return aim
  const along = (BACK - near.z) / span
  return { x: near.x + (far.x - near.x) * along, y: -(near.y + (far.y - near.y) * along) }
}
