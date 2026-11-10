import { Raycaster, Vector2, Vector3, type Camera, type Material, type Object3D, type Scene } from 'three'

/**
 * `?debug=1` only: `globalThis.__pick(x, y)` names what is drawn under a screen pixel (front to back), so a stray shape
 * seen in a screenshot can be traced to the layer and material that drew it.
 */
export function publishPicker(scene: Scene, camera: () => Camera, canvas: HTMLCanvasElement): void {
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const pathOf = (object: Object3D): string => {
    const names: string[] = []
    for (let at: Object3D | null = object; at; at = at.parent) if (at.name) names.push(at.name)
    return names.reverse().join('/')
  }
  const materialOf = (object: Object3D): string => {
    const material = (object as { material?: Material | Material[] }).material
    const list = Array.isArray(material) ? material : material ? [material] : []
    return list.map((entry) => `${entry.type}${entry.name ? `:${entry.name}` : ''}`).join(',')
  }
  const shown = (object: Object3D): boolean => {
    for (let at: Object3D | null = object; at; at = at.parent) if (!at.visible) return false
    return true
  }
  ;(globalThis as { __pick?: unknown }).__pick = (x: number, y: number, all = false) => {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
    const view = camera()
    // Unprojecting two depths follows the pixel look's leaning projection, which `setFromCamera` does not.
    const near = new Vector3(pointer.x, pointer.y, -1).unproject(view)
    const far = new Vector3(pointer.x, pointer.y, 1).unproject(view)
    raycaster.set(near, far.sub(near).normalize())
    raycaster.camera = view
    raycaster.layers.enableAll()
    return raycaster
      .intersectObject(scene, true)
      .filter((hit) => all || shown(hit.object))
      .slice(0, 12)
      .map((hit) => `${pathOf(hit.object) || '(unnamed)'} [${hit.object.type} ${materialOf(hit.object)}] at ${hit.point.x.toFixed(2)},${(-hit.point.y).toFixed(2)},z ${hit.point.z.toFixed(2)}`)
  }
}
