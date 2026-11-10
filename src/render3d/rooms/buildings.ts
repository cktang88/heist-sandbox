import type { Interior, Room } from '../../game/site'

/** One raised building as the exterior dressing sees it: its outer wall columns, roof slab row and ground row. */
export type Building = { name: string; left: number; right: number; roofRow: number; groundRow: number; storeys: number }

const NOT_BUILDINGS = new Set(['grounds', 'sewer', 'silo', 'gatehouse'])
const STOREY = 6

/**
 * Finds each building from its rooms and the interior rectangle that holds them.
 * `left` and `right` are the columns of the outside walls.
 */
export function buildingsOf(rooms: readonly Room[], interiors: readonly Interior[], groundRow: number): Building[] {
  const names = [...new Set(rooms.map((room) => room.building))].filter((name) => !NOT_BUILDINGS.has(name))
  const found: Building[] = []
  for (const name of names) {
    const sample = rooms.find((room) => room.building === name && room.kind !== 'rooftop')!
    const shell = interiors.find((area) => area.kind === 'room' && area.x <= sample.x && area.x + area.w >= sample.x + sample.w && area.y <= sample.y && area.y + area.h >= sample.floorY)
    if (!shell) continue
    found.push({ name, left: shell.x, right: shell.x + shell.w - 1, roofRow: shell.y, groundRow, storeys: Math.round((groundRow - shell.y) / STOREY) })
  }
  return found
}
