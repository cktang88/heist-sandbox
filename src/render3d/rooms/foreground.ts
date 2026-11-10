import { CanvasTexture, DoubleSide, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, Vector2, type Material } from 'three'
import type { Room, TimeOfDay } from '../../game/site'
import { tileAt, type Grid } from '../../game/tiles'
import { tintOf, WHITE, type QuadBatch, type Tint } from './batch'
import type { Building } from './buildings'
import type { ChunkedFinishes } from './chunks'
import { roll } from './hash'

/**
 * A sparse layer of dark shapes between the camera and the walking lane (z about +1.5 to +3):
 * lamp posts, power poles and their cables, railings and perimeter fencing outdoors; columns and pipe runs indoors.
 * They are kept thin, away from doors and stairs, and turn see-through where they cross the player.
 */

/** Where the player is, shared by every foreground material; updated once a frame. */
export const playerAt = { value: new Vector2(-1000, -1000) }

/** Makes a material fade out where it lies between the camera and the player. */
function fadeNearPlayer(material: MeshBasicMaterial): MeshBasicMaterial {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.playerAt = playerAt
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nuniform vec2 playerAt;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // Follow the line of sight through this point back to the walking lane (z = 0) and compare with the player.
        vec2 onLane = cameraPosition.xy + (vWorld.xy - cameraPosition.xy) * cameraPosition.z / (cameraPosition.z - vWorld.z);
        float apart = length((onLane - playerAt) / vec2(1.1, 1.5));
        gl_FragColor.a *= mix(0.15, 1.0, smoothstep(0.7, 1.5, apart));`)
  }
  material.customProgramCacheKey = () => 'fade-near-player'
  return material
}

export type ForegroundKit = { dark: Material; fence: Material; coil: Material }

export function foregroundKit(time: TimeOfDay): ForegroundKit {
  const shade = time === 'night' ? 0.55 : 1
  const make = (options: ConstructorParameters<typeof MeshBasicMaterial>[0]) => fadeNearPlayer(new MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, ...options }))
  return {
    dark: make({ vertexColors: true, opacity: 0.94 }),
    fence: make({ map: wireTexture(), alphaTest: 0.05, side: DoubleSide, color: tintColor(0x1a1e24, shade) }),
    coil: make({ map: coilTexture(), alphaTest: 0.05, side: DoubleSide, color: tintColor(0x22262c, shade) }),
  }
}

function tintColor(hex: number, scale: number): number {
  const r = Math.round(((hex >> 16) & 255) * scale)
  const g = Math.round(((hex >> 8) & 255) * scale)
  const b = Math.round((hex & 255) * scale)
  return (r << 16) | (g << 8) | b
}

function wireTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const c = canvas.getContext('2d')!
  c.strokeStyle = '#ffffff'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(64, 64)
  c.moveTo(64, 0)
  c.lineTo(0, 64)
  c.stroke()
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Loops of razor wire seen side on. */
function coilTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const c = canvas.getContext('2d')!
  c.strokeStyle = '#ffffff'
  c.lineWidth = 2.5
  for (const offset of [0, 64]) {
    c.beginPath()
    c.ellipse(offset + 32, 32, 34, 28, 0.25, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.ellipse(offset + 64, 32, 34, 28, 0.25, 0, Math.PI * 2)
    c.stroke()
  }
  for (let barb = 0; barb < 16; barb += 1) c.fillRect(barb * 8, (barb * 23) % 60, 5, 2)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

export type ForegroundContext = { scene: ChunkedFinishes; kit: ForegroundKit; grid: Grid; groundRow: number; time: TimeOfDay; keepClear: readonly number[] }

/** Near-black, a touch lighter by day so silhouettes do not punch holes in a pale scene. */
function silhouette(ctx: ForegroundContext, seed: number): Tint {
  const base = ctx.time === 'night' ? 0x07080b : 0x1c2026
  return tintOf(base, 0.85 + roll(seed, 1) * 0.3)
}

function clearOf(ctx: ForegroundContext, x: number, margin: number): boolean {
  return ctx.keepClear.every((spot) => Math.abs(spot - x) > margin)
}

const POLE_Z = 2.9
const POST_Z = 2.2
const RAIL_Z = 1.6

/** Posts, poles, cables and railings along the outdoor stretches of ground. */
export function outdoorForeground(ctx: ForegroundContext, room: Room): void {
  if (room.kind !== 'street' && room.kind !== 'yard') return
  const ground = -room.floorY
  for (let x = room.x + 3 + roll(room.id, 2) * 6; x < room.x + room.w - 2; x += 13 + roll(Math.round(x), 3) * 8) {
    if (!clearOf(ctx, x, 3)) continue
    lampPost(ctx, x, ground)
  }
  if (room.kind === 'street') {
    for (let x = room.x + 1; x < room.x + room.w - 4; x += 9) {
      if (roll(Math.round(x), 4) < 0.35 || !clearOf(ctx, x + 2, 4)) continue
      railing(ctx, x, Math.min(room.x + room.w - 1, x + 5), ground)
    }
  }
}

function lampPost(ctx: ForegroundContext, x: number, ground: number): void {
  const batch = ctx.scene.batch(x, -ground, ctx.kit.dark)
  const tint = silhouette(ctx, Math.round(x))
  batch.pipeAlongY(ground - 0.5, ground + 7.2, x, POST_Z, 0.1, tint)
  batch.box(x, ground + 7.05, POST_Z - 0.08, x + 1.6, ground + 7.18, POST_Z + 0.08, 1, tint)
  batch.box(x + 1.2, ground + 6.85, POST_Z - 0.18, x + 1.85, ground + 7.1, POST_Z + 0.18, 1, tint)
  batch.box(x - 0.25, ground - 0.5, POST_Z - 0.25, x + 0.25, ground + 0.4, POST_Z + 0.25, 1, tint)
}

function railing(ctx: ForegroundContext, x0: number, x1: number, ground: number): void {
  const batch = ctx.scene.batch(x0, -ground, ctx.kit.dark)
  const tint = silhouette(ctx, Math.round(x0) + 7)
  for (const y of [0.55, 1.0]) batch.box(x0, ground + y, RAIL_Z - 0.04, x1, ground + y + 0.07, RAIL_Z + 0.04, 1, tint)
  for (let post = x0; post <= x1; post += 1.25) batch.box(post, ground - 0.4, RAIL_Z - 0.05, post + 0.08, ground + 1.07, RAIL_Z + 0.05, 1, tint)
}

/** Power poles across the open ground with sagging lines between them, skipping spans that would cross a building. */
export function powerLines(ctx: ForegroundContext, rooms: readonly Room[], buildings: readonly Building[]): void {
  const ground = -ctx.groundRow
  const poles: number[] = []
  for (const room of rooms) {
    if (room.kind !== 'street' && room.kind !== 'yard') continue
    for (let x = room.x + 2; x < room.x + room.w - 1; x += 22) if (clearOf(ctx, x, 3)) poles.push(x + roll(room.id, x) * 2)
  }
  poles.sort((a, b) => a - b)
  const top = ground + 10
  for (const x of poles) {
    const batch = ctx.scene.batch(x, -ground, ctx.kit.dark)
    const tint = silhouette(ctx, Math.round(x) + 3)
    batch.box(x - 0.13, ground - 0.5, POLE_Z - 0.13, x + 0.13, top + 0.6, POLE_Z + 0.13, 1, tint)
    batch.box(x - 1.3, top, POLE_Z - 0.08, x + 1.3, top + 0.16, POLE_Z + 0.08, 1, tint)
  }
  for (let index = 1; index < poles.length; index += 1) {
    const [a, b] = [poles[index - 1], poles[index]]
    const blocked = buildings.some((building) => building.right >= a && building.left <= b && -building.roofRow > top - 2)
    if (b - a > 45 || blocked) continue
    for (const offset of [-1.1, 0, 1.1]) sag(ctx, a + offset, b + offset, top + 0.15, (b - a) * 0.06)
  }
}

/** A cable hanging between two points as a chain of short straight pieces. */
function sag(ctx: ForegroundContext, x0: number, x1: number, y: number, dip: number): void {
  const pieces = 14
  const batch = ctx.scene.batch((x0 + x1) / 2, -y, ctx.kit.dark)
  const tint = silhouette(ctx, Math.round(x0) + 11)
  const heightAt = (t: number) => y - dip * 4 * t * (1 - t)
  for (let piece = 0; piece < pieces; piece += 1) {
    const [t0, t1] = [piece / pieces, (piece + 1) / pieces]
    const [xa, xb] = [x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1]
    const [ya, yb] = [heightAt(t0), heightAt(t1)]
    const thick = 0.025
    batch.quad([[xa, ya - thick, POLE_Z], [xb, yb - thick, POLE_Z], [xb, yb + thick, POLE_Z], [xa, ya + thick, POLE_Z]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], tint)
  }
}

/** A taller run of fence with razor wire just outside each perimeter fence line. */
export function perimeterFence(ctx: ForegroundContext, fenceX: number, outward: -1 | 1): void {
  const ground = -ctx.groundRow
  const [x0, x1] = outward === -1 ? [fenceX - 13, fenceX - 1.5] : [fenceX + 2.5, fenceX + 14]
  const z = 2.1
  const height = 7
  const wire = ctx.scene.batch(x0, ctx.groundRow, ctx.kit.fence)
  wire.facing(x0, ground, x1, ground + height, z, 0.55, WHITE)
  ctx.scene.batch(x0, ctx.groundRow, ctx.kit.coil).facing(x0, ground + height - 0.1, x1, ground + height + 0.9, z + 0.05, 1.1, WHITE)
  const posts = ctx.scene.batch(x0, ctx.groundRow, ctx.kit.dark)
  const tint = silhouette(ctx, fenceX)
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) posts.box(x - 0.08, ground - 0.4, z - 0.08, x + 0.08, ground + height + 0.3, z + 0.08, 1, tint)
  posts.box(x0, ground + height - 0.1, z - 0.05, x1, ground + height, z + 0.05, 1, tint)
}

/** Industrial rooms where a pipe run in the foreground looks natural. */
const PIPED = new Set(['mechanical', 'electrical', 'storage', 'garage', 'loadingDock', 'workshop', 'kitchen', 'server', 'lockers', 'janitor', 'sewer'])

/** Structural piers in front of the building's end walls and of some frame beams, and pipe runs in plant rooms. */
export function indoorForeground(ctx: ForegroundContext, building: Building, rooms: readonly Room[]): void {
  for (let storey = 1; storey < building.storeys; storey += 1) {
    const floorRow = building.groundRow - storey * 6
    for (const column of [building.left, building.right]) {
      if (!solidThrough(ctx.grid, column, floorRow)) continue
      pier(ctx, column + 0.5, floorRow, 5, 0.7)
    }
  }
  for (const room of rooms) {
    if (room.building !== building.name || room.kind === 'stairwell' || room.kind === 'rooftop') continue
    for (let x = building.left + 14; x < building.right; x += 14) {
      if (x < room.x + 2 || x > room.x + room.w - 3 || roll(room.id * 31 + x, 5) > 0.3) continue
      pier(ctx, x + 0.5, room.floorY, room.h, 0.5)
    }
    if (PIPED.has(room.kind) && roll(room.id, 6) < 0.55) pipeRun(ctx, room)
  }
}

/** True when nothing opens through this wall column on the storey above `floorRow` (no door, arch or broken gap). */
function solidThrough(grid: Grid, column: number, floorRow: number): boolean {
  for (let row = floorRow - 3; row < floorRow; row += 1) {
    const kind = tileAt(grid, column, row)
    if (kind === 'door' || kind === 'air' || kind === 'ladder') return false
  }
  return true
}

function pier(ctx: ForegroundContext, x: number, floorRow: number, height: number, width: number): void {
  const batch: QuadBatch = ctx.scene.batch(x, floorRow - height / 2, ctx.kit.dark)
  const floor = -floorRow
  const tint = silhouette(ctx, Math.round(x) * 7 + floorRow)
  batch.box(x - width / 2, floor - 0.05, 1.5, x + width / 2, floor + height + 0.05, 1.5 + width, 1, tint)
}

function pipeRun(ctx: ForegroundContext, room: Room): void {
  const ceiling = -room.y
  const batch = ctx.scene.batch(room.x + room.w / 2, room.y, ctx.kit.dark)
  const tint = silhouette(ctx, room.id + 5)
  const y = ceiling - 0.35
  batch.pipeAlongX(room.x, room.x + room.w, y, 1.7, 0.14, tint)
  for (let x = room.x + 1.5; x < room.x + room.w; x += 3.5) batch.box(x, y, 1.66, x + 0.06, ceiling, 1.74, 1, tint)
}
