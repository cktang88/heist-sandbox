import type { Vec } from './types'

/** One frame of player intent. The game core only ever sees this, never the keyboard. */
export type Input = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  jumpPressed: boolean
  jumpHeld: boolean
  fire: boolean
  firePressed: boolean
  interact: boolean
  interactPressed: boolean
  detonatePressed: boolean
  focus: boolean
  /** Where the player is pointing, in tile units. */
  aim: Vec
  selectTool: number | null
}

export function idleInput(aim: Vec = { x: 0, y: 0 }): Input {
  return {
    left: false, right: false, up: false, down: false, jumpPressed: false, jumpHeld: false, fire: false, firePressed: false,
    interact: false, interactPressed: false, detonatePressed: false, focus: false, aim, selectTool: null,
  }
}
