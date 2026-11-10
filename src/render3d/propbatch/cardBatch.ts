import { Box3, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three'
import { BOX } from '../props/kit'
import { cardPage, type Card } from './cardAtlas'
import { CARD_DEPTH, CARD_RECT, cardMaterial } from './cardMaterial'

/**
 * A region's cards: one instanced quad per prop, one draw per atlas page (normally one). Hiding a prop shrinks its
 * quad to nothing. Props that throw shadows also get a box of their size, drawn only into shadow maps (a flat card
 * seen from a lamp above would throw almost no shadow): it has no instances except while a shadow map is drawn, so
 * the main pass skips it without a draw call.
 */

export type CardUse = { prop: number; card: Card; placement: Matrix4; mirrored: boolean; shadow: Box3 | null }

export type CardSet = { meshes: InstancedMesh[]; setHidden(prop: number, hidden: boolean): void; dispose(): void }

const PROXY_MATERIAL = new MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const scratch = new Matrix4()
const at = new Vector3()
const size = new Vector3()

function quadMatrix(use: CardUse, target: Matrix4): Matrix4 {
  const { card } = use
  const sign = use.mirrored ? -1 : 1
  at.set((sign * (card.x0 + card.x1)) / 2, (card.y0 + card.y1) / 2, card.front)
  // Placement without its mirror: the card itself is not mirrored, its texture rectangle is.
  const placement = use.mirrored ? scratch.copy(use.placement).scale(size.set(-1, 1, 1)) : use.placement
  at.applyMatrix4(placement)
  return target.makeScale(card.x1 - card.x0, card.y1 - card.y0, 1).setPosition(at)
}

function quadsFor(page: number, uses: CardUse[]): InstancedMesh {
  const geometry = new PlaneGeometry(1, 1)
  const rects = new Float32Array(uses.length * 4)
  const depths = new Float32Array(uses.length)
  uses.forEach(({ card, mirrored }, i) => {
    const [u0, v0, u1, v1] = card.uv
    rects.set(mirrored ? [u1, v0, u0, v1] : [u0, v0, u1, v1], i * 4)
    depths[i] = card.depth
  })
  geometry.setAttribute(CARD_RECT, new InstancedBufferAttribute(rects, 4))
  geometry.setAttribute(CARD_DEPTH, new InstancedBufferAttribute(depths, 1))
  const mesh = new InstancedMesh(geometry, cardMaterial(cardPage(page)), uses.length)
  const matrix = new Matrix4()
  uses.forEach((use, i) => mesh.setMatrixAt(i, quadMatrix(use, matrix)))
  mesh.receiveShadow = true
  mesh.matrixAutoUpdate = false
  mesh.computeBoundingSphere()
  return mesh
}

function shadowBoxesFor(uses: CardUse[]): InstancedMesh | null {
  const casting = uses.filter((use) => use.shadow)
  if (casting.length === 0) return null
  const mesh = new InstancedMesh(BOX, PROXY_MATERIAL, casting.length)
  const matrix = new Matrix4()
  casting.forEach((use, i) => {
    const box = use.shadow!.clone().applyMatrix4(use.placement)
    mesh.setMatrixAt(i, matrix.makeScale(...box.getSize(size).toArray()).setPosition(box.getCenter(at)))
  })
  mesh.castShadow = true
  mesh.matrixAutoUpdate = false
  mesh.computeBoundingSphere()
  mesh.count = 0
  mesh.onBeforeShadow = () => {
    mesh.count = casting.length
  }
  mesh.onAfterShadow = () => {
    mesh.count = 0
  }
  return mesh
}

export function buildCards(uses: CardUse[]): CardSet {
  const byPage = new Map<number, CardUse[]>()
  for (const use of uses) {
    const list = byPage.get(use.card.page) ?? byPage.set(use.card.page, []).get(use.card.page)!
    list.push(use)
  }
  const meshes: InstancedMesh[] = []
  const slots = new Map<number, { mesh: InstancedMesh; index: number; use: CardUse }[]>()
  for (const [page, list] of byPage) {
    const mesh = quadsFor(page, list)
    meshes.push(mesh)
    list.forEach((use, index) => {
      const entry = slots.get(use.prop) ?? slots.set(use.prop, []).get(use.prop)!
      entry.push({ mesh, index, use })
    })
  }
  const boxes = shadowBoxesFor(uses)
  if (boxes) meshes.push(boxes)
  const boxIndex = new Map(uses.filter((use) => use.shadow).map((use, i) => [use.prop, i]))
  const matrix = new Matrix4()
  return {
    meshes,
    setHidden(prop, hidden) {
      for (const { mesh, index, use } of slots.get(prop) ?? []) {
        mesh.setMatrixAt(index, hidden ? HIDDEN : quadMatrix(use, matrix))
        mesh.instanceMatrix.needsUpdate = true
      }
      const box = boxIndex.get(prop)
      if (boxes && box !== undefined) {
        const use = uses.find((candidate) => candidate.prop === prop)!
        const bounds = use.shadow!.clone().applyMatrix4(use.placement)
        boxes.setMatrixAt(box, hidden ? HIDDEN : matrix.makeScale(...bounds.getSize(size).toArray()).setPosition(bounds.getCenter(at)))
        boxes.instanceMatrix.needsUpdate = true
      }
    },
    dispose() {
      for (const mesh of meshes) {
        if (mesh.geometry !== BOX) mesh.geometry.dispose()
        mesh.dispose()
      }
    },
  }
}
