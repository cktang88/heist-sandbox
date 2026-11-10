import type { EventDef } from '../types'
import { blackout } from './blackout'
import { chatter } from './chatter'
import { courier } from './courier'
import { crawler } from './crawler'
import { deal } from './deal'
import { engineer } from './engineer'
import { evacuation } from './evacuation'
import { patrolSwap } from './patrolSwap'
import { phoneCall } from './phoneCall'
import { smokeBreak } from './smokeBreak'
import { sweep } from './sweep'
import { wanderer } from './wanderer'

/** Every event the director can spring. The order is part of the seed's meaning: append new ones at the end. */
export const EVENTS: readonly EventDef[] = [
  smokeBreak, blackout, phoneCall, patrolSwap, wanderer, chatter, sweep, courier, evacuation, engineer, crawler, deal,
]
