import { bandOf, CARRIES, carriesVertically, DUCT, HANGER_ROWS, SOLID, storeyedMask, type SlabRow } from './support'
import type { Grid } from './tiles'

/**
 * The support check done locally: given the tiles changed since everything was last known to be held up, finds what
 * is now loose by looking only around them, with the same answer `findUnsupported` (collapse.ts) would give for the
 * whole site. Returns null when the local look cannot settle it, and the caller then checks the whole site.
 *
 * How. Whatever lost its support must have been held through a changed tile, so it is reached from a tile beside one.
 * From each such tile a search walks back along what could hold it up (heading down first, where the ground is) and
 * stops as soon as it reaches the bottom of the map. A search that runs out without reaching it has found a piece
 * cut off from the ground; the piece is still held if any of it lies within the reach of a building slab that still
 * stands (see `holdSlab` in collapse.ts), and otherwise it is loose. A slab stands while some tile of its row is held
 * up; the slabs whose row lost a tile, or holds a piece cut off from the ground, are checked again the same way, and
 * a slab that has lost its whole row has every tile it held looked at.
 *
 * Ducts hang from the slab two rows up, which holds one way only. Rather than track that, any search that crosses a
 * hanger, and anything that would leave a duct dangling, gives up to the whole-site check, as does a slab held only
 * through another slab. Those are rare; a floor holed by a blast is not.
 */
export function findUnsupportedNear(grid: Grid, slabs: readonly SlabRow[], changed: readonly number[]): number[] | null {
  begin(grid, slabs)
  if (!queueAroundChanges(grid, slabs, changed)) return null
  for (const candidate of candidates) search(grid, slabs, candidate)
  const loose: number[] = []
  // Settling a slab or a piece can find more of both, so both lists are walked as they grow.
  for (let slab = 0, piece = 0; slab < recheck.length || piece < pieceStarts.length;) {
    if (slab < recheck.length) {
      if (slabStands(grid, slabs, recheck[slab++]) === UNSURE) return null
      continue
    }
    const held = pieceHeld(grid, slabs, piece, -1)
    if (held === UNSURE) return null
    if (held === NO) {
      if (leavesDuctHanging(grid, piece)) return null
      for (let at = pieceStarts[piece]; at < pieceEnds[piece]; at += 1) if (SOLID[grid.kinds[members[at]]]) loose.push(members[at])
    }
    piece += 1
  }
  // Past its budget the answers above were cut short: the whole-site check is the cheaper way now.
  if (walked > budget) return null
  loose.sort((a, b) => a - b)
  return loose
}

const NO = 0
const YES = 1
const UNSURE = 2
type Answer = typeof NO | typeof YES | typeof UNSURE

/** What a search found for a tile, valid while `seen[index]` is this call's stamp. WALKING: the search under way. */
const WALKING = 0
const GROUNDED = 1
const CUT_OFF = 2

/** A slab's state while this call works it out. */
const SLAB_UNKNOWN = 0
const SLAB_CHECKING = 1
const SLAB_STANDS = 2
const SLAB_DOWN = 3

/** Scratch kept between calls, sized to the grid: a stamp per tile saying this call has seen it, and what it found. */
let seen = new Int32Array(0)
let found = new Uint8Array(0)
/** For a tile in a cut-off piece, which piece. */
let pieceOf = new Int32Array(0)
let stack = new Int32Array(0)
let stamp = 0
/** Tiles to search from, slabs to check again, and the cut-off pieces found (as runs of `members`). */
const candidates: number[] = []
const recheck: number[] = []
const members: number[] = []
const pieceStarts: number[] = []
const pieceEnds: number[] = []
/** For each piece, the run of `hangers` it owns: tiles outside it that ducts in it hang from. */
const hangers: number[] = []
const hangerStarts: number[] = []
const hangerEnds: number[] = []
/** Pieces whose hold is being worked out, so a ring of pieces hanging from each other is noticed. */
const asked: boolean[] = []
let slabState = new Uint8Array(0)
/** Each slab's band (see `bandOf`) as x0, x1, y0, y1. */
let bands = new Int32Array(0)
/** For each row of the grid: the slabs whose row it is, and the slabs whose band takes it in. */
type Rows = { slabsOnRow: number[][]; bandsOnRow: number[][] }
let rows: Rows = { slabsOnRow: [], bandsOnRow: [] }
/** Where ladders carry up and down (see `storeyedMask`). */
let storeyed: Uint8Array = new Uint8Array(0)
const rowsBySlabs = new WeakMap<readonly SlabRow[], Rows>()

function begin(grid: Grid, slabs: readonly SlabRow[]): void {
  const size = grid.width * grid.height
  if (seen.length !== size || stamp >= 0x7fffffff) {
    seen = new Int32Array(size)
    found = new Uint8Array(size)
    pieceOf = new Int32Array(size)
    stack = new Int32Array(size)
    stamp = 0
  }
  stamp += 1
  walked = 0
  budget = Math.max(MIN_BUDGET, Math.floor(size * BUDGET_SHARE))
  if (slabState.length < slabs.length) slabState = new Uint8Array(slabs.length)
  slabState.fill(SLAB_UNKNOWN)
  if (bands.length < slabs.length * 4) bands = new Int32Array(slabs.length * 4)
  for (let entry = 0; entry < slabs.length; entry += 1) {
    const band = bandOf(grid, slabs[entry])
    bands[entry * 4] = band.x0
    bands[entry * 4 + 1] = band.x1
    bands[entry * 4 + 2] = band.y0
    bands[entry * 4 + 3] = band.y1
  }
  rows = rowsFor(grid, slabs)
  storeyed = storeyedMask(grid, slabs)
  candidates.length = 0
  recheck.length = 0
  members.length = 0
  pieceStarts.length = 0
  pieceEnds.length = 0
  hangers.length = 0
  hangerStarts.length = 0
  hangerEnds.length = 0
  asked.length = 0
}

/** The slabs filed by row (see `Rows`), made once per list of slabs. */
function rowsFor(grid: Grid, slabs: readonly SlabRow[]): Rows {
  const known = rowsBySlabs.get(slabs)
  if (known && known.slabsOnRow.length === grid.height) return known
  const made: Rows = { slabsOnRow: [], bandsOnRow: [] }
  for (let y = 0; y < grid.height; y += 1) {
    made.slabsOnRow.push([])
    made.bandsOnRow.push([])
  }
  slabs.forEach((slab, entry) => {
    if (slab.y >= 0 && slab.y < grid.height) made.slabsOnRow[slab.y].push(entry)
    const band = bandOf(grid, slab)
    for (let y = band.y0; y <= band.y1; y += 1) made.bandsOnRow[y].push(entry)
  })
  rowsBySlabs.set(slabs, made)
  return made
}

/**
 * Queues the tiles that may have lost their support (every changed tile that carries weight, the tiles beside a
 * changed one, and a duct hanging from one), and the slabs whose row lost a tile. Returns false if the changes are
 * too many to be worth it locally.
 */
function queueAroundChanges(grid: Grid, slabs: readonly SlabRow[], changed: readonly number[]): boolean {
  const { width, kinds } = grid
  const size = kinds.length
  // Past this, the whole-site check (one pass over every tile) is the cheaper way.
  if (changed.length * 6 > size) return false
  const hanger = HANGER_ROWS * width
  const queue = (index: number): void => {
    if (CARRIES[kinds[index]]) candidates.push(index)
  }
  for (const index of changed) {
    const x = index % width
    queue(index)
    if (index >= width) queue(index - width)
    if (index + width < size) queue(index + width)
    if (x > 0) queue(index - 1)
    if (x < width - 1) queue(index + 1)
    if (index + hanger < size && kinds[index + hanger] === DUCT) queue(index + hanger)
    if (SOLID[kinds[index]]) continue
    const y = (index - x) / width
    for (const entry of rows.slabsOnRow[y]) {
      const slab = slabs[entry]
      if (x >= slab.x0 && x <= slab.x1) recheck.push(entry)
    }
  }
  return true
}

/**
 * Walks back from a tile along what could hold it up, until it reaches the bottom of the map or a tile already known
 * to be held (GROUNDED), or runs out (CUT_OFF: the tiles walked form a piece cut off from the ground). Everything a
 * search walks is connected both ways, so what it finds holds for every tile it walked. A duct is also held by the
 * slab two rows above it, a hold that goes one way only, so it is not walked: a cut-off piece keeps the list of such
 * tiles, and is held if one of them is (see `pieceHeld`).
 */
function search(grid: Grid, slabs: readonly SlabRow[], start: number): number {
  if (seen[start] === stamp) return found[start]
  // Over budget, nothing found from here on counts (see `findUnsupportedNear`): stop walking.
  if (walked > budget) return GROUNDED
  const { width, kinds } = grid
  const size = kinds.length
  const bottom = size - width
  const hanger = HANGER_ROWS * width
  const first = members.length
  const firstHanger = hangers.length
  stackTop = 0
  touchedGround = false
  visit(kinds, start)
  let grounded = false
  while (stackTop > 0) {
    const index = stack[--stackTop]
    members.push(index)
    if (index >= bottom && SOLID[kinds[index]]) {
      grounded = true
      break
    }
    if (kinds[index] === DUCT && index >= hanger && CARRIES[kinds[index - hanger]]) {
      const above = index - hanger
      const known = seen[above] === stamp
      if (known && found[above] === GROUNDED) {
        grounded = true
        break
      }
      if (!known || found[above] !== WALKING) hangers.push(above)
    }
    const x = index % width
    // Pushed last, so taken first: the ground is below.
    if (index >= width && carriesVertically(kinds, storeyed, index, index - width)) visit(kinds, index - width)
    if (x > 0) visit(kinds, index - 1)
    if (x < width - 1) visit(kinds, index + 1)
    if (index + width < size && carriesVertically(kinds, storeyed, index, index + width)) visit(kinds, index + width)
    if (touchedGround) {
      grounded = true
      break
    }
  }
  if (grounded) {
    // Tiles still waiting on the stack were not walked: they stay unknown.
    for (; stackTop > 0; stackTop -= 1) seen[stack[stackTop - 1]] = 0
    for (let at = first; at < members.length; at += 1) found[members[at]] = GROUNDED
    members.length = first
    hangers.length = firstHanger
    return GROUNDED
  }
  const piece = pieceStarts.length
  pieceStarts.push(first)
  pieceEnds.push(members.length)
  hangerStarts.push(firstHanger)
  hangerEnds.push(hangers.length)
  asked.push(false)
  for (let at = first; at < members.length; at += 1) {
    found[members[at]] = CUT_OFF
    pieceOf[members[at]] = piece
  }
  queueSlabsInRow(grid, slabs, piece)
  return CUT_OFF
}

/** The search stack's height, and whether it has stepped next to a tile known to be held; shared with `visit`. */
let stackTop = 0
/**
 * Tiles walked by this call, and how many it may walk. The whole-site check walks every tile in about the time this
 * walks an eighth of them, so past that share (a site so wrecked that whole storeys hang on one another) it gives up.
 */
let walked = 0
let budget = 0
const BUDGET_SHARE = 1 / 8
/** On a small grid either check is quick; the local one keeps going. */
const MIN_BUDGET = 1024
let touchedGround = false

function visit(kinds: Uint8Array, index: number): void {
  if (seen[index] === stamp) {
    if (found[index] === GROUNDED) touchedGround = true
    return
  }
  if (!CARRIES[kinds[index]]) return
  seen[index] = stamp
  found[index] = WALKING
  stack[stackTop++] = index
  walked += 1
}

/** A cut-off piece with tiles in a slab's row may have been what kept that slab standing: check it again. */
function queueSlabsInRow(grid: Grid, slabs: readonly SlabRow[], piece: number): void {
  for (let at = pieceStarts[piece]; at < pieceEnds[piece]; at += 1) {
    const index = members[at]
    if (!SOLID[grid.kinds[index]]) continue
    const x = index % grid.width
    const y = (index - x) / grid.width
    for (const entry of rows.slabsOnRow[y]) {
      const slab = slabs[entry]
      if (x >= slab.x0 && x <= slab.x1 && slabState[entry] === SLAB_UNKNOWN) recheck.push(entry)
    }
  }
}

/**
 * Whether a slab still stands: some solid tile of its row reaches the ground, or lies in a piece another standing
 * slab holds. A slab whose row has no solid tile left is down, and every tile it held is searched from.
 */
function slabStands(grid: Grid, slabs: readonly SlabRow[], entry: number): Answer {
  const state = slabState[entry]
  if (state === SLAB_STANDS) return YES
  if (state === SLAB_DOWN) return NO
  // A slab held only through a ring of other slabs: the whole-site check settles that.
  if (state === SLAB_CHECKING) return UNSURE
  const slab = slabs[entry]
  if (slab.y < 0 || slab.y >= grid.height) {
    slabState[entry] = SLAB_DOWN
    return NO
  }
  slabState[entry] = SLAB_CHECKING
  const band = bandOf(grid, slab)
  const row = slab.y * grid.width
  let anySolid = false
  for (let x = band.x0; x <= band.x1; x += 1) {
    if (!SOLID[grid.kinds[row + x]]) continue
    anySolid = true
    if (search(grid, slabs, row + x) === GROUNDED) return settle(entry, SLAB_STANDS)
  }
  for (let x = band.x0; x <= band.x1 && anySolid; x += 1) {
    if (!SOLID[grid.kinds[row + x]]) continue
    const held = pieceHeld(grid, slabs, pieceOf[row + x], entry)
    if (held === UNSURE) return UNSURE
    if (held === YES) return settle(entry, SLAB_STANDS)
  }
  // Down: whatever it held may be loose now, so every tile it held is searched from.
  settle(entry, SLAB_DOWN)
  for (let y = band.y0; y <= band.y1; y += 1) {
    for (let x = band.x0; x <= band.x1; x += 1) {
      const index = y * grid.width + x
      if (SOLID[grid.kinds[index]]) search(grid, slabs, index)
    }
  }
  return NO
}

function settle(entry: number, state: number): Answer {
  slabState[entry] = state
  return state === SLAB_STANDS ? YES : NO
}

/**
 * Whether a cut-off piece is held: it has a solid tile within reach of a slab that still stands (not counting slab
 * `asking`), or a duct in it hangs from something held.
 */
function pieceHeld(grid: Grid, slabs: readonly SlabRow[], piece: number, asking: number): Answer {
  const bySlab = heldBySlab(grid, slabs, piece, asking)
  if (bySlab === YES) return YES
  let unsure = bySlab === UNSURE
  asked[piece] = true
  for (let at = hangerStarts[piece]; at < hangerEnds[piece]; at += 1) {
    const above = hangers[at]
    if (search(grid, slabs, above) === GROUNDED) {
      asked[piece] = false
      return YES
    }
    const other = pieceOf[above]
    if (other === piece) continue
    const held = asked[other] ? UNSURE : pieceHeld(grid, slabs, other, asking)
    if (held === YES) {
      asked[piece] = false
      return YES
    }
    if (held === UNSURE) unsure = true
  }
  asked[piece] = false
  return unsure ? UNSURE : NO
}

function heldBySlab(grid: Grid, slabs: readonly SlabRow[], piece: number, asking: number): Answer {
  let unsure = false
  for (let at = pieceStarts[piece]; at < pieceEnds[piece]; at += 1) {
    const index = members[at]
    if (!SOLID[grid.kinds[index]]) continue
    const x = index % grid.width
    const y = (index - x) / grid.width
    for (const entry of rows.bandsOnRow[y]) {
      if (entry === asking || x < bands[entry * 4] || x > bands[entry * 4 + 1]) continue
      // Asked again for each tile, but a slab is worked out once a call: after that this is a lookup.
      const stands = slabStands(grid, slabs, entry)
      if (stands === YES) return YES
      if (stands === UNSURE) unsure = true
    }
  }
  return unsure ? UNSURE : NO
}

/** True if a loose piece holds up a duct that is not part of it, which would then hang from nothing. */
function leavesDuctHanging(grid: Grid, piece: number): boolean {
  const hanger = HANGER_ROWS * grid.width
  for (let at = pieceStarts[piece]; at < pieceEnds[piece]; at += 1) {
    const below = members[at] + hanger
    if (below < grid.kinds.length && grid.kinds[below] === DUCT && !(seen[below] === stamp && found[below] === CUT_OFF && pieceOf[below] === piece)) return true
  }
  return false
}
