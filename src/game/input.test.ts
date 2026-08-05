import { describe, expect, it } from 'vitest'
import { keyboardAction } from './input'

describe('keyboard controls', () => {
  it('maps battle and setup shortcuts to narrow actions', () => {
    expect(keyboardAction(' ', 'Space')).toEqual({ kind: 'primary' })
    expect(keyboardAction('2')).toEqual({ kind: 'power', index: 1 })
    expect(keyboardAction('+')).toEqual({ kind: 'speed', speed: 2 })
    expect(keyboardAction('-')).toEqual({ kind: 'speed', speed: 1 })
    expect(keyboardAction('Tab')).toEqual({ kind: 'statistics' })
    expect(keyboardAction('Escape')).toEqual({ kind: 'cancel' })
    expect(keyboardAction('Delete')).toEqual({ kind: 'delete' })
    expect(keyboardAction('r')).toEqual({ kind: 'rotate' })
    expect(keyboardAction('q')).toBeNull()
  })
})
