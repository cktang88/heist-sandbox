import { Group } from 'three'
import type { LayerFactory } from './layer'

/** (Not built yet.) */
export const createStructureLayer: LayerFactory = () => ({ group: new Group(), update() {} })
