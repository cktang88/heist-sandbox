/** Game seconds as a clock reading from the drop: 150 is "2:30". */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
