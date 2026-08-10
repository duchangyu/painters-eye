import type { TargetDirection } from '../domain/calibration'

const GAP_VECTORS: Readonly<
  Record<TargetDirection, readonly [x: number, y: number]>
> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
}

export function isInsideLandoltC(
  x: number,
  y: number,
  direction: TargetDirection,
): boolean {
  const radius = Math.hypot(x, y)
  if (radius < 0.28 || radius > 0.5) {
    return false
  }

  const [gapX, gapY] = GAP_VECTORS[direction]
  const alongGap = x * gapX + y * gapY
  const acrossGap = Math.abs(x * -gapY + y * gapX)
  const isGap = alongGap > 0.16 && acrossGap < 0.2

  return !isGap
}
