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

/** Writes the keys a prop belongs under into `keys` (already empty). A prop with none is not filed. */
export type KeysOf = (prop: PropState, keys: number[]) => void

const scratch: number[] = []

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
    scratch.length = 0
    keysOf(prop, scratch)
    if (sameKeys(scratch, slot.keys)) continue
    for (const key of slot.keys) unfile(buckets.byKey, key, prop.id)
    slot.keys = scratch.slice()
    for (const key of slot.keys) fileSorted(buckets.byKey, key, prop.id)
  }
  buckets.props = props
  return buckets
}

function build(props: readonly PropState[], keysOf: KeysOf): PropBuckets {
  const byKey = new Map<number, number[]>()
  const slots = props.map((prop) => file(byKey, prop, keysOf))
  return { props, byKey, slots }
}

function file(byKey: Map<number, number[]>, prop: PropState, keysOf: KeysOf): { id: number; keys: number[] } {
  const keys: number[] = []
  keysOf(prop, keys)
  for (const key of keys) fileSorted(byKey, key, prop.id)
  return { id: prop.id, keys }
}

function sameKeys(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
  return true
}

function fileSorted(byKey: Map<number, number[]>, key: number, id: number): void {
  const list = byKey.get(key)
  if (!list) {
    byKey.set(key, [id])
    return
  }
  let at = list.length
  while (at > 0 && list[at - 1] > id) at -= 1
  list.splice(at, 0, id)
}

function unfile(byKey: Map<number, number[]>, key: number, id: number): void {
  const list = byKey.get(key)
  const at = list ? list.indexOf(id) : -1
  if (!list || at < 0) return
  list.splice(at, 1)
  if (list.length === 0) byKey.delete(key)
}
