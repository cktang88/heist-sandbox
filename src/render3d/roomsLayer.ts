import { Group } from 'three'
import type { Room } from '../game/site'
import { tileAt } from '../game/tiles'
import type { World } from '../game/world'
import type { LayerFactory } from './layer'
import { buildingsOf } from './rooms/buildings'
import { ChunkedFinishes } from './rooms/chunks'
import { COMPANY } from './rooms/art'
import { dressBuilding, dressGround } from './rooms/exterior'
import { CORRIDOR, finishOf } from './rooms/finishes'
import { foregroundKit, indoorForeground, outdoorForeground, perimeterFence, playerAt, powerLines, type ForegroundContext } from './rooms/foreground'
import { finishSpace, type FinishContext, type Space } from './rooms/interior'
import { finishKit } from './rooms/kit'
import { shaftLinings } from './rooms/shafts'

/** Rooms below ground or sealed by design have no windows to the outside. */
const WINDOWLESS = new Set(['sewer', 'silo'])

function spaceOf(room: Room, groundRow: number): Space {
  return {
    id: room.id, kind: room.kind, x: room.x, w: room.w, floorRow: room.floorY, h: room.h, storey: room.storey,
    windows: room.storey >= 0 && room.floorY <= groundRow && !WINDOWLESS.has(room.kind),
  }
}

/** Indoor areas with a back wall but no room record, such as the sky bridge, are finished as plain corridors. */
function corridors(world: World): Space[] {
  return world.interiors
    .filter((area) => area.kind === 'room' && !world.rooms.some((room) => room.x >= area.x && room.x < area.x + area.w && room.y >= area.y && room.y < area.y + area.h))
    .map((area, index) => ({ id: 10000 + index, kind: 'corridor', x: area.x, w: area.w, floorRow: area.y + area.h, h: area.h - 1, storey: 1, windows: true }))
}

/** Columns at street level that must stay clear of foreground clutter: doors, gates, ladders and manholes. */
function groundOpenings(world: World): number[] {
  const openings: number[] = []
  for (let x = 0; x < world.grid.width; x += 1) {
    const above = tileAt(world.grid, x, world.groundY - 1)
    if (above === 'door' || above === 'ladder' || tileAt(world.grid, x, world.groundY) === 'ladder') openings.push(x + 0.5)
  }
  return openings
}

function perimeterColumns(world: World): number[] {
  const columns: number[] = []
  for (let x = 0; x < world.grid.width; x += 1) {
    if (tileAt(world.grid, x, world.groundY - 5) === 'fence' && tileAt(world.grid, x, world.groundY - 1) !== 'air') columns.push(x)
  }
  return columns
}

/**
 * Wall, floor and ceiling finishes for every room, windows in the back walls, building facades and signs,
 * street and yard markings, and a sparse dark foreground layer. Everything is merged per area and material
 * and built once; each frame only hides far chunks, folds away finishes over destroyed tiles, and fades
 * foreground shapes that cross the player.
 */
export const createRoomsLayer: LayerFactory = (world) => {
  const group = new Group()
  const finishes = new ChunkedFinishes()
  const kit = finishKit(world.timeOfDay)
  const ctx: FinishContext = { scene: finishes, kit, grid: world.grid }
  for (const room of world.rooms) {
    const finish = finishOf(room.kind)
    if (finish) finishSpace(ctx, spaceOf(room, world.groundY), finish)
  }
  for (const corridor of corridors(world)) finishSpace(ctx, corridor, CORRIDOR)
  shaftLinings(ctx, world.elevators, world.groundY)

  const buildings = buildingsOf(world.rooms, world.interiors, world.groundY)
  const outside = { scene: finishes, kit, grid: world.grid, time: world.timeOfDay, company: COMPANY }
  for (const building of buildings) dressBuilding(outside, building)
  for (const room of world.rooms) dressGround(outside, room)
  finishes.build(true)

  const foreground = new ChunkedFinishes()
  const near: ForegroundContext = {
    scene: foreground, kit: foregroundKit(world.timeOfDay), grid: world.grid, groundRow: world.groundY, time: world.timeOfDay, keepClear: groundOpenings(world),
  }
  for (const room of world.rooms) outdoorForeground(near, room)
  powerLines(near, world.rooms, buildings)
  for (const column of perimeterColumns(world)) perimeterFence(near, column, column < world.grid.width / 2 ? -1 : 1)
  for (const building of buildings) indoorForeground(near, building, world.rooms)
  foreground.build(false)
  for (const mesh of foreground.group.children) mesh.renderOrder = 10

  group.add(finishes.group, foreground.group)
  return {
    group,
    update(now, frame) {
      finishes.update(now.grid, frame)
      foreground.update(now.grid, frame)
      const hero = now.player
      playerAt.value.set(hero.x + hero.w / 2, -(hero.y + hero.h / 2))
    },
  }
}
