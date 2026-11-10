import { ImageLoader, RepeatWrapping, Source, SRGBColorSpace, Texture } from 'three'

/**
 * Photo textures from `public/`, each file loaded and sent to the GPU once however many materials use it, at whatever
 * repeat. Textures that share a `Source` and the same sampling settings share one GPU texture in three, so every copy
 * here gets the same source and the same anisotropy (set once by the surface materials, before any prop is built).
 */

const sources = new Map<string, { source: Source<HTMLImageElement | null>; waiting: Texture[] | null }>()
const loader = new ImageLoader()
let anisotropy = 1

export function setPhotoAnisotropy(value: number): void {
  anisotropy = value
}

/** A repeating photo texture for `path` (relative to `public/`, e.g. `textures/wood/color.jpg`). */
export function photoTexture(path: string, repeatX: number, repeatY: number, isColor: boolean): Texture {
  let entry = sources.get(path)
  if (!entry) {
    const created = { source: new Source<HTMLImageElement | null>(null), waiting: [] as Texture[] | null }
    sources.set(path, created)
    loader.load(`${import.meta.env.BASE_URL}${path}`, (image) => {
      created.source.data = image
      for (const texture of created.waiting ?? []) texture.needsUpdate = true
      created.waiting = null
    })
    entry = created
  }
  const texture = new Texture()
  texture.source = entry.source
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = anisotropy
  if (isColor) texture.colorSpace = SRGBColorSpace
  if (entry.waiting) entry.waiting.push(texture)
  else texture.needsUpdate = true
  return texture
}
