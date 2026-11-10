import { DataTexture, LinearFilter, Matrix4, MeshStandardMaterial, RedFormat, UnsignedByteType, Vector2, type WebGLProgramParametersWithUniforms } from 'three'
import type { Grid } from '../../game/tiles'
import { CHUNK_TILES } from '../../game/tiles'
import { createSkyMap, RAY_REACH, updateSkyMap, type SkyMap } from './skyLight'

/**
 * Feeds the sky-visibility map into every physically based material, so sky light (environment map,
 * hemisphere and ambient fill) fades out inside enclosed rooms and returns when a wall or roof is blown open.
 *
 * It hooks `MeshStandardMaterial.prototype.onBeforeCompile`, which every standard and physical material
 * inherits unless it sets its own. That keeps the other render files untouched: they get the effect for free.
 */

/** Shared by every patched program, so one write per frame reaches them all. */
const uniforms = {
  skyMap: { value: null as DataTexture | null },
  skyMapSize: { value: new Vector2(1, 1) },
  skyViewToWorld: { value: new Matrix4() },
  /** How much sky light a fully enclosed surface still gets (0..1), diffuse and specular. */
  skyIndoorDiffuse: { value: 0.15 },
  skyIndoorSpecular: { value: 0.08 },
}

const FRAGMENT_HEADER = /* glsl */ `
uniform sampler2D skyMap;
uniform vec2 skyMapSize;
uniform mat4 skyViewToWorld;
uniform float skyIndoorDiffuse;
uniform float skyIndoorSpecular;
float skyOpenness() {
  vec3 world = (skyViewToWorld * vec4(-vViewPosition, 1.0)).xyz;
  // Game rows run downward, and the texture's first row is row 0.
  float seen = texture2D(skyMap, vec2(world.x, -world.y) / skyMapSize).r;
  // Air beside a wall sees only half the sky, so half counts as fully outdoors.
  return smoothstep(0.0, 0.5, seen);
}
`

function patch(shader: WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, uniforms)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAGMENT_HEADER}`)
    .replace('#include <lights_fragment_begin>', /* glsl */ `#include <lights_fragment_begin>
      float skyOpen = skyOpenness();
      irradiance *= mix(skyIndoorDiffuse, 1.0, skyOpen);`)
    .replace('#include <lights_fragment_end>', /* glsl */ `
      iblIrradiance *= mix(skyIndoorDiffuse, 1.0, skyOpen);
      radiance *= mix(skyIndoorSpecular, 1.0, skyOpen);
      #include <lights_fragment_end>`)
}

let installed = false

function install(): void {
  if (installed) return
  installed = true
  MeshStandardMaterial.prototype.onBeforeCompile = patch
}

export type SkyShading = {
  /** Call once per frame before drawing: refreshes damaged areas and tells shaders where the camera is. */
  update(cameraWorld: Matrix4): void
  /** Tiles changed in these chunks (indices as in `grid.dirtyChunks`). */
  markChunks(chunks: Iterable<number>): void
  setIndoor(diffuse: number, specular: number): void
  dispose(): void
}

/** Frames between refreshes of damaged areas, so a firefight does not recompute every frame. */
const REFRESH_FRAMES = 12

export function createSkyShading(grid: Grid): SkyShading {
  install()
  const map: SkyMap = createSkyMap(grid)
  const texture = new DataTexture(map.values, grid.width, grid.height, RedFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  uniforms.skyMap.value = texture
  uniforms.skyMapSize.value.set(grid.width, grid.height)

  const across = Math.ceil(grid.width / CHUNK_TILES)
  let pending: { x0: number; y0: number; x1: number; y1: number } | null = null
  let wait = 0

  return {
    update(cameraWorld) {
      uniforms.skyViewToWorld.value.copy(cameraWorld)
      wait = Math.max(0, wait - 1)
      if (!pending || wait > 0) return
      // Damage changes what the tiles below it, and to either side within a ray's reach, can see.
      updateSkyMap(map, grid, pending.x0 - RAY_REACH, pending.y0, pending.x1 + RAY_REACH, pending.y1 + RAY_REACH)
      texture.needsUpdate = true
      pending = null
      wait = REFRESH_FRAMES
    },
    markChunks(chunks) {
      for (const index of chunks) {
        const x0 = (index % across) * CHUNK_TILES
        const y0 = Math.floor(index / across) * CHUNK_TILES
        const x1 = x0 + CHUNK_TILES - 1
        const y1 = y0 + CHUNK_TILES - 1
        pending = pending ? { x0: Math.min(pending.x0, x0), y0: Math.min(pending.y0, y0), x1: Math.max(pending.x1, x1), y1: Math.max(pending.y1, y1) } : { x0, y0, x1, y1 }
      }
    },
    setIndoor(diffuse, specular) {
      uniforms.skyIndoorDiffuse.value = diffuse
      uniforms.skyIndoorSpecular.value = specular
    },
    dispose() {
      texture.dispose()
    },
  }
}
