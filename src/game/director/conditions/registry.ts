import type { ConditionDef } from '../types'
import { backupPower } from './backupPower'
import { delivery } from './delivery'
import { fireDrill } from './fireDrill'
import { inspection } from './inspection'
import { party } from './party'
import { rain } from './rain'
import { rivalCrew } from './rivalCrew'
import { scaffolding } from './scaffolding'
import { shiftChange } from './shiftChange'
import { skeletonCrew } from './skeletonCrew'
import { storm } from './storm'
import { vipVisit } from './vipVisit'

/** Every condition a night can have. The order is part of the seed's meaning: append new ones at the end. */
export const CONDITIONS: readonly ConditionDef[] = [
  rain, storm, backupPower, skeletonCrew, vipVisit, shiftChange, delivery, scaffolding, fireDrill, party, inspection, rivalCrew,
]
