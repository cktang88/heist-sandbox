import { afterEach, describe, expect, it } from 'vitest'
import { attachInput } from './inputDevice'
import type { Camera } from './render/camera'
import { wheelSelection } from './game/toolDefs'

/** A stand-in for the browser's event targets: records listeners and lets a test fire events at them. */
function target() {
  const listeners = new Map<string, ((event: object) => void)[]>()
  return {
    addEventListener(type: string, listener: (event: object) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
    fire(type: string, event: object = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
  }
}

const camera: Camera = { x: 0, y: 0, scale: 10, width: 100, height: 100 }
const original = (globalThis as { window?: unknown }).window

function setUp() {
  const win = target()
  ;(globalThis as { window?: unknown }).window = win
  const canvas = Object.assign(target(), { width: 100, height: 100, clientWidth: 100, clientHeight: 100 })
  const device = attachInput(canvas as unknown as HTMLCanvasElement, 10)
  const key = (type: 'keydown' | 'keyup', code: string, ctrlKey = false) => {
    let prevented = false
    win.fire(type, { code, ctrlKey, repeat: false, preventDefault: () => (prevented = true) })
    return prevented
  }
  return { win, canvas, device, key }
}

afterEach(() => {
  ;(globalThis as { window?: unknown }).window = original
})

describe('the keyboard and mouse adapter', () => {
  it('keeps Ctrl, the crouch key, from handing game keys to the browser (Ctrl+R would reload the page)', () => {
    const { device, key } = setUp()
    key('keydown', 'ControlLeft', true)
    expect(key('keydown', 'KeyR', true)).toBe(true)
    expect(key('keydown', 'KeyD', true)).toBe(true)
    const input = device.read(camera)
    expect(input.crouch).toBe(true)
    expect(input.reloadPressed).toBe(true)
    expect(key('keydown', 'F5')).toBe(false)
  })

  it('crouches with either Ctrl key', () => {
    const { device, key } = setUp()
    key('keydown', 'ControlRight', true)
    expect(device.read(camera).crouch).toBe(true)
  })

  it('stops firing when the window loses focus with the button held', () => {
    const { win, canvas, device } = setUp()
    canvas.fire('mousedown', { button: 0 })
    expect(device.read(camera).fire).toBe(true)
    win.fire('blur')
    expect(device.read(camera).fire).toBe(false)
  })
})

describe('the mouse wheel', () => {
  it('steps one tool per notch, and a trackpad stream of tiny scrolls adds up to a notch instead of one step each', () => {
    const { canvas, device } = setUp()
    const wheel = (deltaY: number, deltaMode = 0) => canvas.fire('wheel', { deltaY, deltaMode, preventDefault: () => {} })
    for (let event = 0; event < 10; event += 1) wheel(4)
    expect(device.read(camera).selectTool).toBeNull()
    for (let event = 0; event < 15; event += 1) wheel(4)
    expect(device.read(camera).selectTool).toBe(wheelSelection(1))
    wheel(100)
    expect(device.read(camera).selectTool).toBe(wheelSelection(1))
    wheel(-3, 1)
    expect(device.read(camera).selectTool).toBe(wheelSelection(-1))
    wheel(-100)
    expect(device.read(camera).selectTool).toBe(wheelSelection(-1))
  })
})
