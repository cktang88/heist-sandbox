import { describe, expect, it } from 'vitest'
import { createProps, type PropState } from '../cover'
import { addKey, currentBuckets, type KeysOf } from './buckets'

const byColumn: KeysOf = (prop, keys) => {
  addKey(keys, Math.floor(prop.x / 4))
  if (prop.kind === 'sofa') addKey(keys, Math.floor(prop.x / 4) + 1)
}

function snapshot(byKey: Map<number, number[]>): Record<number, number[]> {
  return Object.fromEntries([...byKey].filter(([, ids]) => ids.length > 0).sort((a, b) => a[0] - b[0]))
}

describe('prop buckets', () => {
  const start = (): PropState[] => createProps([
    { kind: 'crate', x: 1, y: 5 }, { kind: 'sofa', x: 6, y: 5 }, { kind: 'crate', x: 9, y: 5 }, { kind: 'desk', x: 13, y: 5 },
  ])

  it('follows props that moved when handed a fresh list, exactly as a full rebuild would', () => {
    const props = start()
    const buckets = currentBuckets(null, props, byColumn)
    const moved = props.slice()
    moved[0].x = 14
    moved[3].x = 2
    const updated = currentBuckets(buckets, moved, byColumn)
    expect(snapshot(updated.byKey)).toEqual(snapshot(currentBuckets(null, moved, byColumn).byKey))
    expect(updated.byKey.get(3)).toEqual([0])
    expect(updated.byKey.get(0)).toEqual([3])
  })

  it('keeps ids in each bucket in ascending order', () => {
    const props = start()
    const buckets = currentBuckets(null, props, byColumn)
    props[3].x = 9
    props[0].x = 10
    const updated = currentBuckets(buckets, props.slice(), byColumn)
    expect(updated.byKey.get(2)).toEqual([0, 1, 2, 3])
  })

  it('files props added to the list, and looks again at the same list when asked to', () => {
    const props = start()
    const buckets = currentBuckets(null, props, byColumn)
    props.push({ ...props[0], id: 4, x: 17 })
    expect(currentBuckets(buckets, props, byColumn).byKey.get(4)).toEqual([4])
    props[4].x = 1
    expect(currentBuckets(buckets, props, byColumn).byKey.get(4)).toEqual([4])
    expect(currentBuckets(buckets, props, byColumn, true).byKey.get(0)).toEqual([0, 4])
  })
})
