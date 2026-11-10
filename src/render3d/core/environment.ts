import { FogExp2, PMREMGenerator, type Scene, type Texture, type WebGLRenderer } from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { SKIES } from '../assetManifest'
import type { Look } from './looks'

/**
 * The photographed sky behind `scene.environment`, plus fog and exposure, for the current look.
 * Skies load in the background and are kept once filtered, so a restart on the same time of day is instant.
 */
export type Environment = {
  apply(look: Look): void
  /** Settles once the sky asked for last has loaded (or failed to). */
  ready(): Promise<void>
}

export function createEnvironment(renderer: WebGLRenderer, scene: Scene): Environment {
  const filter = new PMREMGenerator(renderer)
  const filtered = new Map<string, Texture>()
  const loading = new Map<string, Promise<void>>()
  const fog = new FogExp2(0x000000, 0)
  scene.fog = fog
  let wanted = ''
  let current: Promise<void> = Promise.resolve()

  /**
   * Play never starts before the sky has arrived (or failed to), so nothing stands in for it: rendering a studio
   * surround for the meantime took seconds of GPU time at start-up on slow machines and was never seen.
   */
  function show(look: Look): void {
    scene.environment = filtered.get(look.sky) ?? null
    scene.environmentIntensity = look.skyStrength
  }

  function load(look: Look): Promise<void> {
    const pending = loading.get(look.sky)
    if (filtered.has(look.sky)) return Promise.resolve()
    if (pending) return pending
    const done = new Promise<void>((resolve) => {
      new HDRLoader().load(`${import.meta.env.BASE_URL}${SKIES[look.sky]}`, (sky) => {
        filtered.set(look.sky, filter.fromEquirectangular(sky).texture)
        sky.dispose()
        if (wanted === look.sky) show(look)
        resolve()
      }, undefined, () => resolve())
    })
    loading.set(look.sky, done)
    void done.then(() => loading.delete(look.sky))
    return done
  }

  return {
    apply(look) {
      wanted = look.sky
      fog.color.setHex(look.fogColor)
      fog.density = look.fogDensity
      renderer.toneMapping = look.toneMapping
      renderer.toneMappingExposure = look.exposure
      show(look)
      current = load(look)
    },
    ready() {
      return current
    },
  }
}
