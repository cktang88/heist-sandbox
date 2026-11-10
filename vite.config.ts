import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import { MODELS } from './src/render3d/assetManifest'
import { EXTRA_MODELS } from './src/render3d/assetManifestExtra'
import { LITE_MODELS } from './src/render3d/liteModels'

const PROP_SOURCES = 'src/render3d'

/** Originals the game can still ask for: named in the prop sources, with no light copy to load instead. */
function originalsStillLoaded(): Set<string> {
  const sources = fs
    .readdirSync(PROP_SOURCES, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.includes('assetManifest'))
    .map((file) => fs.readFileSync(path.join(PROP_SOURCES, file), 'utf8'))
    .join('\n')
  const needed = [...MODELS, ...EXTRA_MODELS].filter((model) => !LITE_MODELS.has(model.url) && sources.includes(`'${model.id}'`))
  // `models/<folder>/<file>.gltf` and `models2/<file>.glb` both name their entry in the first two parts.
  return new Set(needed.map((model) => model.url.split('/').slice(0, 2).join('/')))
}

/**
 * The model libraries are most of public/, but the game loads a light copy (`lite/`) of nearly every model it uses.
 * The originals nothing asks for stay out of the built site.
 */
function shipOnlyModelsTheGameLoads(): Plugin {
  return {
    name: 'ship-only-models-the-game-loads',
    apply: 'build',
    closeBundle() {
      const keep = originalsStillLoaded()
      for (const library of ['models', 'models2']) {
        for (const entry of fs.readdirSync(path.join('dist', library))) {
          if (entry === 'lite' || entry === 'CREDITS.md' || keep.has(`${library}/${entry}`)) continue
          fs.rmSync(path.join('dist', library, entry), { recursive: true })
        }
      }
    },
  }
}

// Parallel build agents keep working copies under .claude/worktrees. They are not part of this checkout,
// so neither the dev server nor the tests should look at them.
export default defineConfig({
  // Relative paths, so the built site works from any folder (GitHub Pages serves it under /<repo>/).
  base: './',
  plugins: [shipOnlyModelsTheGameLoads()],
  server: { watch: { ignored: ['**/.claude/**'] } },
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Generous, because the big-site tests are slow when the machine is busy.
    testTimeout: 30_000,
  },
})
