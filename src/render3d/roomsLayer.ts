import { Group } from 'three'
import type { LayerFactory } from './layer'

/** (Not built yet.) */
export const createRoomsLayer: LayerFactory = () => ({ group: new Group(), update() {} })
