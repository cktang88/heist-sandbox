import { Group } from 'three'
import { PROP_CATALOG, type PropKind } from '../../game/propCatalog'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropBuilder, PropSet } from './index'
import { library } from './kit'
import { pick } from './officeParts'

/**
 * Kinds drawn with a textured model from the extra library (`EXTRA_MODELS`) where it looks better than the built one.
 * Each entry lists the models to rotate between; 'built' keeps the hand-built model as one of the variants.
 * Flat-coloured CAD models are left out (they clash with the photo-textured rest), and so is anything heavy that
 * appears often.
 */
type Choice = { models: readonly (string | 'built')[]; onWall?: boolean }

const CHOICES: Partial<Record<PropKind, Choice>> = {
  bin: { models: ['trash-can-metal', 'trash-can-rusty'] },
  serverRack: { models: ['server-rack'] },
  waterCooler: { models: ['water-cooler'] },
  fridge: { models: ['fridge-black', 'built'] },
  sink: { models: ['kitchen-cabinet-sink'] },
  toilet: { models: ['toilet'] },
  dumpster: { models: ['dumpster-green', 'dumpster-graffiti'] },
  lockerRow: { models: ['locker-row-orange'] },
  stepLadder: { models: ['step-ladder'] },
  coatRack: { models: ['coat-rack'] },
  medicalBed: { models: ['stretcher-hospital'] },
  ivStand: { models: ['iv-stand'] },
  roofAcUnit: { models: ['ac-condenser'] },
  forklift: { models: ['forklift'] },
  pallet: { models: ['pallet-euro', 'pallet-wood'] },
  safeSmall: { models: ['safe-old'] },
  poolTable: { models: ['pool-table-2'] },
  tableTennis: { models: ['table-tennis'] },
  treadmill: { models: ['treadmill-2'] },
  fireHydrant: { models: ['fire-hydrant', 'fire-hydrant-2'] },
  bollard: { models: ['bollard-steel', 'bollard-concrete'] },
  trophyCase: { models: ['display-vitrine'] },
  vendingMachine: { models: ['vending-machine-snacks', 'built'] },
  intercom: { models: ['intercom-panel'], onWall: true },
  wallAc: { models: ['window-ac'], onWall: true },
}

function chooser(kind: PropKind, choice: Choice, built: PropBuilder | undefined): PropBuilder {
  const { w, h } = PROP_CATALOG[kind]
  return (materials: SurfaceMaterials) => {
    const model = choice.models[pick(`library:${kind}`, choice.models.length)]
    if (model === 'built' && built) return built(materials)
    const group = new Group()
    library(group, model === 'built' ? String(choice.models[0]) : model, { w, h, onWall: choice.onWall })
    return group
  }
}

/** The library versions of the kinds above, given the hand-built set they replace (used for 'built' variants). */
export function libraryProps(built: PropSet): PropSet {
  const set: PropSet = {}
  for (const [kind, choice] of Object.entries(CHOICES) as [PropKind, Choice][]) set[kind] = chooser(kind, choice, built[kind])
  return set
}
