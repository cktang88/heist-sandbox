export type Vec = { x: number; y: number }

/** Axis-aligned box in tile units. x,y is the top-left corner. */
export type Body = Vec & { w: number; h: number; vx: number; vy: number; onGround: boolean }

export type Rect = Vec & { w: number; h: number }

export function centerOf(body: Rect): Vec {
  return { x: body.x + body.w / 2, y: body.y + body.h / 2 }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
