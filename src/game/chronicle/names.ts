import { nameOf } from '../security/barks'
import type { Guard } from '../security/model'
import type { World } from '../world'

/**
 * What the story calls a guard. If a people module has given guards names (`world.people.nameOf`), that name;
 * otherwise the name his colleagues already shout in the barks, with his job in front when it matters
 * ("officer Brandt", "the heavy Sato"). Responders brought in later have no name and are "a responder".
 */

type People = { nameOf?: (guard: Guard) => string | undefined }

export function guardName(world: World, index: number): string {
  const guard = world.guards[index]
  if (!guard) return 'a guard'
  const given = (world as World & { people?: People }).people?.nameOf?.(guard)
  if (given) return given
  if (guard.armored && guard.role === 'patrol') return 'a responder'
  const name = nameOf(index)
  switch (guard.role) {
    case 'officer': return `officer ${name}`
    case 'heavy': return `the heavy ${name}`
    case 'operator': return `the operator ${name}`
    default: return name
  }
}
