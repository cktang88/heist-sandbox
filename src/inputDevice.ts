import type { Input } from './game/input'
import { wheelSelection } from './game/toolDefs'
import { screenToWorld, type Camera } from './render/camera'

/** Thin adapter: turns keyboard and mouse events into the Input the game core understands. */
export type InputDevice = { read(camera: Camera): Input; consumeRestart(): boolean }

export function attachInput(canvas: HTMLCanvasElement, toolCount: number): InputDevice {
  const held = new Set<string>()
  const pressed = new Set<string>()
  const mouse = { x: 0, y: 0, down: false, pressed: false }
  let wheel = 0
  let restart = false

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Tab') event.preventDefault()
    if (!event.repeat) pressed.add(event.code)
    held.add(event.code)
  })
  window.addEventListener('keyup', (event) => held.delete(event.code))
  window.addEventListener('blur', () => held.clear())
  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.offsetX
    mouse.y = event.offsetY
  })
  canvas.addEventListener('mousedown', (event) => {
    // Right-click sets off planted C4, the same as Q.
    if (event.button === 2) pressed.add('KeyQ')
    if (event.button !== 0) return
    mouse.down = true
    mouse.pressed = true
  })
  window.addEventListener('mouseup', () => (mouse.down = false))
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault()
    wheel += Math.sign(event.deltaY)
  }, { passive: false })
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())

  return {
    read(camera) {
      let selectTool: number | null = null
      // Keys 1-9 pick the first nine tools and 0 picks the tenth.
      for (let index = 0; index < toolCount; index += 1) if (pressed.has(`Digit${(index + 1) % 10}`)) selectTool = index
      if (wheel !== 0) selectTool = wheelSelection(wheel)
      const scaleX = canvas.width / canvas.clientWidth
      const scaleY = canvas.height / canvas.clientHeight
      const input: Input = {
        left: held.has('KeyA') || held.has('ArrowLeft'),
        right: held.has('KeyD') || held.has('ArrowRight'),
        up: held.has('KeyW') || held.has('ArrowUp'),
        down: held.has('KeyS') || held.has('ArrowDown'),
        jumpPressed: pressed.has('Space'),
        jumpHeld: held.has('Space'),
        fire: mouse.down,
        firePressed: mouse.pressed,
        interact: held.has('KeyE'),
        interactPressed: pressed.has('KeyE'),
        detonatePressed: pressed.has('KeyQ'),
        reloadPressed: pressed.has('KeyR'),
        focus: held.has('ShiftLeft') || held.has('ShiftRight'),
        crouch: held.has('KeyC') || held.has('ControlLeft'),
        punchPressed: pressed.has('KeyF'),
        kickPressed: pressed.has('KeyV'),
        grab: held.has('KeyG'),
        throwPressed: pressed.has('KeyT'),
        aim: screenToWorld(camera, mouse.x * scaleX, mouse.y * scaleY),
        selectTool,
      }
      restart = restart || pressed.has('Enter')
      pressed.clear()
      mouse.pressed = false
      wheel = 0
      return input
    },
    consumeRestart() {
      const wanted = restart
      restart = false
      return wanted
    },
  }
}
