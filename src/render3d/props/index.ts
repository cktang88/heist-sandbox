import type { Group } from 'three'
import type { PropKind } from '../../game/propCatalog'
import type { SurfaceMaterials } from '../levelMesh'
import { buildProp as buildPlainProp } from '../props3d'
import { DECOR_PROPS } from './decor'
import { EXTERIOR_PROPS } from './exterior'
import { INDUSTRIAL_PROPS } from './industrial'
import { libraryProps } from './library'
import { LIVING_PROPS } from './living'
import { OFFICE_PROPS } from './office'
import { SECURITY_PROPS } from './security'

/**
 * Builds the 3D model for one prop. Floor props stand on y = 0 centred on x = 0, with z = 0 the walking lane
 * and negative z toward the back wall (which is at about z = -2.4). Wall props are centred on x = 0 with their
 * TOP edge at y = 0 and should sit just in front of the back wall. Ceiling props hang down from y = 0.
 * One unit is one tile, about 1.1 metres.
 */
export type PropBuilder = (materials: SurfaceMaterials) => Group
export type PropSet = Partial<Record<PropKind, PropBuilder>>

const BUILT: PropSet = { ...OFFICE_PROPS, ...LIVING_PROPS, ...INDUSTRIAL_PROPS, ...SECURITY_PROPS, ...EXTERIOR_PROPS, ...DECOR_PROPS }
const BUILDERS: PropSet = { ...BUILT, ...libraryProps(BUILT) }

export function buildProp(kind: PropKind, materials: SurfaceMaterials): Group {
  return BUILDERS[kind]?.(materials) ?? buildPlainProp(kind, materials)
}
