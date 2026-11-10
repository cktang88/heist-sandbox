import type { PropState } from '../cover'

/**
 * Prop ids grouped by number keys (the tiles a prop covers, the column band it stands in), so a lookup only
 * looks at its neighbourhood. Physics props move, and when one has moved far enough `world.props` is handed over
 * as a fresh array of the same props (physprops/state.ts); the buckets then move only the props whose keys
 * changed instead of rebuilding from scratch, which in a fight happened many times a second. Ids in a bucket stay
 * in ascending order, the order a full rebuild gives, so lookups answer exactly as before.
 */
export type PropBuckets = {
  props: readonly PropState[]
  byKey: Map<number, number[]>
  /** Per position in `props`: the prop's id and the keys it is filed under. */
  slots: { id: number; keys: number[] }[]
}

/** Keys being collected for one prop. A typed buffer, so collecting them for every prop allocates nothing. */
export type KeyList = { values: Int32Array; count: number }

/** Adds the keys a prop belongs under to `keys` (already empty) with `addKey`. A prop with none is not filed. */
export type KeysOf = (prop: PropState, keys: KeyList) => void

/** No prop covers anywhere near this many tiles. */
const MOST_KEYS = 512
const scratch: KeyList = { values: new Int32Array(MOST_KEYS), count: 0 }

export function addKey(keys: KeyList, key: number): void {
  if (keys.count < MOST_KEYS) keys.values[keys.count++] = key
}

function keysNow(prop: PropState, keysOf: KeysOf): KeyList {
  scratch.count = 0
  keysOf(prop, scratch)
  return scratch
}

/**
 * The buckets for the current prop list, brought up to date if the list was replaced or grew, or if `recheck`
 * says a prop may have moved within the same list.
 */
export function currentBuckets(buckets: PropBuckets | null, props: readonly PropState[], keysOf: KeysOf, recheck = false): PropBuckets {
  if (!recheck && buckets && buckets.props === props && buckets.slots.length === props.length) return buckets
  if (!buckets || props.length < buckets.slots.length) return build(props, keysOf)
  for (let index = 0; index < props.length; index += 1) {
    const prop = props[index]
    const slot = buckets.slots[index]
    if (!slot) {
      buckets.slots.push(file(buckets.byKey, prop, keysOf))
      continue
    }
    // A different list altogether: start again.
    if (slot.id !== prop.id) return build(props, keysOf)
    refileSlot(buckets, slot, prop, keysOf)
  }
  buckets.props = props
  return buckets
}

/**
 * Brings one prop up to date after it moved within the list the buckets were built for, so a single prop landing
 * somewhere new does not mean asking every prop where it is.
 */
export function refile(buckets: PropBuckets, prop: PropState, keysOf: KeysOf): void {
  const { props } = buckets
  const position = props[prop.id] === prop ? prop.id : props.indexOf(prop)
  const slot = buckets.slots[position]
  if (slot && slot.id === prop.id) refileSlot(buckets, slot, prop, keysOf)
}

function refileSlot(buckets: PropBuckets, slot: { id: number; keys: number[] }, prop: PropState, keysOf: KeysOf): void {
  const keys = keysNow(prop, keysOf)
  if (sameKeys(keys, slot.keys)) return
  for (const key of slot.keys) unfile(buckets.byKey, key, prop.id)
  slot.keys = Array.from(keys.values.subarray(0, keys.count))
  for (const key of slot.keys) fileSorted(buckets.byKey, key, prop.id)
}

function build(props: readonly PropState[], keysOf: KeysOf): PropBuckets {
  const byKey = new Map<number, number[]>()
  const slots = props.map((prop) => file(byKey, prop, keysOf))
  return { props, byKey, slots }
}

function file(byKey: Map<number, number[]>, prop: PropState, keysOf: KeysOf): { id: number; keys: number[] } {
  const now = keysNow(prop, keysOf)
  const keys = Array.from(now.values.subarray(0, now.count))
  for (const key of keys) fileSorted(byKey, key, prop.id)
  return { id: prop.id, keys }
}

function sameKeys(now: KeyList, filed: readonly number[]): boolean {
  if (now.count !== filed.length) return false
  for (let index = 0; index < now.count; index += 1) if (now.values[index] !== filed[index]) return false
  return true
}

function fileSorted(byKey: Map<number, number[]>, key: number, id: number): void {
  const list = byKey.get(key)
  if (!list) {
    byKey.set(key, [id])
    return
  }
  // Shuffled into place by hand: splice would allocate an array of removed items on every call.
  let at = list.length
  list.push(id)
  while (at > 0 && list[at - 1] > id) {
    list[at] = list[at - 1]
    at -= 1
  }
  list[at] = id
}

function unfile(byKey: Map<number, number[]>, key: number, id: number): void {
  const list = byKey.get(key)
  const at = list ? list.indexOf(id) : -1
  if (!list || at < 0) return
  for (let index = at; index < list.length - 1; index += 1) list[index] = list[index + 1]
  list.pop()
  if (list.length === 0) byKey.delete(key)
}
