import { loadSettings } from './store'
import { startupParams } from './settings'
import { randomSeed } from './address'

/**
 * Runs before any other game module (it is the first import in `main.ts`): writes the stored settings into the
 * address, where the game already reads them, without overriding a parameter the address gives explicitly.
 * It also pins the seed in the address, so reloading for a new look or quality replays the same heist.
 */
const params = startupParams(loadSettings(), new URLSearchParams(location.search))
const seed = Number(params.get('seed'))
if (!(Number.isFinite(seed) && seed > 0)) params.set('seed', String(randomSeed()))
const search = `?${params.toString()}`
if (search !== location.search) history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`)
