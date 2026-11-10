import { CHUNK_TILES, type Grid } from '../../game/tiles'
import type { Vec } from '../../game/types'

/**
 * A big explosion can dirty dozens of tile chunks in one frame, and re-meshing them all at once stalled a frame for
 * 70 ms. Only the few nearest the view are re-meshed each frame; the rest wait their turn.
 */
export const CHUNKS_PER_FRAME = 3

/**
 * Takes all but the `keep` dirty chunks nearest `view` out of `grid.dirtyChunks` and returns them, so the mesher
 * (which re-meshes and clears the whole set) only sees the nearest ones. Put the returned ones back afterwards.
 */
export function holdBackFarChunks(grid: Grid, view: Vec, keep = CHUNKS_PER_FRAME): number[] {
  if (grid.dirtyChunks.size <= keep) return []
  const across = Math.ceil(grid.width / CHUNK_TILES)
  const distance = (index: number) => {
    const x = ((index % across) + 0.5) * CHUNK_TILES
    const y = (Math.floor(index / across) + 0.5) * CHUNK_TILES
    return Math.abs(x - view.x) + Math.abs(y - view.y)
  }
  const sorted = [...grid.dirtyChunks].sort((a, b) => distance(a) - distance(b))
  const held = sorted.slice(keep)
  for (const index of held) grid.dirtyChunks.delete(index)
  return held
}
