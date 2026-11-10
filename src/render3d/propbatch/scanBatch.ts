import { InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Group, type Material } from 'three'

/**
 * Every copy of one scanned model in one region, drawn as instances: one draw per piece of the model,
 * however many props use it. Mirrored copies (flipped props) go in their own batch, because a mirror turns
 * triangles inside out and three can only correct that per object, not per instance.
 */

/** One prop's use of a scanned model, already placed in the world. */
export type ScanUse = { world: Matrix4; prop: number; castShadow: boolean }

type Piece = { geometry: BufferGeometry; material: Material | Material[]; matrix: Matrix4 }

const MIRROR = new Matrix4().makeScale(-1, 1, 1)
const HIDDEN = new Matrix4().makeScale(0, 0, 0)

function piecesOf(scene: Group): Piece[] {
  scene.updateMatrixWorld(true)
  const toScene = new Matrix4().copy(scene.matrixWorld).invert()
  const pieces: Piece[] = []
  scene.traverse((object) => {
    if (object instanceof Mesh) pieces.push({ geometry: object.geometry, material: object.material, matrix: new Matrix4().multiplyMatrices(toScene, object.matrixWorld) })
  })
  return pieces
}

export type ScanInstances = { hide(prop: number): void; dispose(): void }

export function instanceScans(uses: ScanUse[], scene: Group, into: Group): ScanInstances {
  const meshes: { mesh: InstancedMesh; props: number[] }[] = []
  const pieces = piecesOf(scene)
  for (const mirrored of [false, true]) {
    for (const castShadow of [false, true]) {
      const chosen = uses.filter((use) => (use.world.determinant() < 0) === mirrored && use.castShadow === castShadow)
      if (chosen.length > 0) for (const piece of pieces) meshes.push(instance(piece, chosen, mirrored, castShadow, into))
    }
  }
  return {
    hide(prop) {
      for (const { mesh, props } of meshes) {
        const at = props.indexOf(prop)
        if (at < 0) continue
        mesh.setMatrixAt(at, HIDDEN)
        mesh.instanceMatrix.needsUpdate = true
      }
    },
    dispose() {
      for (const { mesh } of meshes) {
        into.remove(mesh)
        mesh.dispose()
      }
    },
  }
}

function instance(piece: Piece, uses: ScanUse[], mirrored: boolean, castShadow: boolean, into: Group): { mesh: InstancedMesh; props: number[] } {
  const mesh = new InstancedMesh(piece.geometry, piece.material, uses.length)
  const matrix = new Matrix4()
  uses.forEach((use, index) => {
    matrix.multiplyMatrices(use.world, piece.matrix)
    // The batch itself carries the mirror, so three flips its triangles back; each instance is then unmirrored.
    if (mirrored) matrix.premultiply(MIRROR)
    mesh.setMatrixAt(index, matrix)
  })
  if (mirrored) mesh.scale.x = -1
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  mesh.computeBoundingSphere()
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  into.add(mesh)
  return { mesh, props: uses.map((use) => use.prop) }
}
