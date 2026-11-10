import type { BufferGeometry } from 'three'
import { MIRROR } from './batchPlan'

/**
 * A copy of a shape mirrored across x, with its triangles turned back the right way out. Batched instances cannot
 * be mirrored individually (three corrects mirroring per object), so flipped props use mirrored shapes instead.
 */
export function mirrorGeometry(geometry: BufferGeometry): BufferGeometry {
  const copy = geometry.clone().applyMatrix4(MIRROR)
  const index = copy.index
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      const b = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, b)
    }
    return copy
  }
  for (const attribute of Object.values(copy.attributes)) {
    for (let i = 0; i + 2 < attribute.count; i += 3) {
      for (let k = 0; k < attribute.itemSize; k += 1) {
        const b = attribute.getComponent(i + 1, k)
        attribute.setComponent(i + 1, k, attribute.getComponent(i + 2, k))
        attribute.setComponent(i + 2, k, b)
      }
    }
  }
  return copy
}
