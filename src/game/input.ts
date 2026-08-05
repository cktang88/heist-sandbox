export type KeyboardAction =
  | { kind: 'primary' }
  | { kind: 'tuning' }
  | { kind: 'cancel' }
  | { kind: 'statistics' }
  | { kind: 'delete' }
  | { kind: 'rotate' }
  | { kind: 'speed'; speed: 1 | 2 }
  | { kind: 'power'; index: 0 | 1 | 2 }

export function keyboardAction(key: string, code = ''): KeyboardAction | null {
  if (code === 'Space' || key === ' ') return { kind: 'primary' }
  if (key === '`') return { kind: 'tuning' }
  if (key === 'Escape') return { kind: 'cancel' }
  if (key === 'Tab') return { kind: 'statistics' }
  if (key === 'Delete' || key === 'Backspace') return { kind: 'delete' }
  if (key.toLowerCase() === 'r') return { kind: 'rotate' }
  if (key === '+' || key === '=') return { kind: 'speed', speed: 2 }
  if (key === '-' || key === '_') return { kind: 'speed', speed: 1 }
  if (key === '1' || key === '2' || key === '3') return { kind: 'power', index: Number(key) - 1 as 0 | 1 | 2 }
  return null
}
