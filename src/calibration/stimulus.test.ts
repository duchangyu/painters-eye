import { describe, expect, it } from 'vitest'
import { getMachadoMatrix } from '../color/machado'
import type { Matrix3 } from '../color/matrix'
import {
  AXIS_VECTORS,
  createStimulus,
  LUMINANCE_JITTER,
} from './stimulus'

type Vector3 = [number, number, number]

function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function normalize(v: Vector3): Vector3 {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

/** Null direction of a rank-2 matrix (the confusion axis of a dichromat). */
function nullDirection(matrix: Matrix3): Vector3 {
  return normalize(cross(matrix[0], matrix[1]))
}

function angleDegrees(a: readonly number[], b: readonly number[]): number {
  const dot = a[0] * b[0]! + a[1] * b[1]! + a[2] * b[2]!
  return (Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI
}

describe('AXIS_VECTORS ground truth', () => {
  it.each(['protan', 'deutan'] as const)(
    'matches the Machado 100%% %s null direction within 2°',
    (axis) => {
      const reference = nullDirection(getMachadoMatrix(axis, 1))
      expect(angleDegrees(AXIS_VECTORS[axis], reference)).toBeLessThan(2)
    },
  )

  it('uses unit-length vectors so delta means the same step on every axis', () => {
    for (const vector of Object.values(AXIS_VECTORS)) {
      expect(Math.hypot(vector[0], vector[1], vector[2])).toBeCloseTo(1, 3)
    }
  })
})

describe('createStimulus', () => {
  it('is reproducible and selects a valid target direction', () => {
    const first = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    const second = createStimulus({ seed: 9, axis: 'deutan', delta: 0.04 })
    expect(first).toEqual(second)
    expect(['up', 'right', 'down', 'left']).toContain(first.direction)
  })

  it('draws the gap direction from the random stream, not from the seed number', () => {
    // Consecutive seeds must not cycle deterministically through directions
    // (the old `seed % 4` behavior made direction a function of trial order).
    const directions = new Set(
      Array.from(
        { length: 8 },
        (_, index) =>
          createStimulus({ seed: 1000 + index, axis: 'protan', delta: 0.05 })
            .direction,
      ),
    )
    expect(directions.size).toBeGreaterThan(1)
  })

  it('keeps the residual luminance step below the jitter noise floor', () => {
    // True confusion axes carry a small luminance component; the per-dot
    // achromatic jitter must be large enough to mask it at working deltas.
    for (const axis of ['protan', 'deutan'] as const) {
      const stimulus = createStimulus({ seed: 3, axis, delta: 0.1 })
      const luminanceStep = Math.abs(
        stimulus.foregroundLuminance - stimulus.backgroundLuminance,
      )
      // Encoded-space jitter of ±LUMINANCE_JITTER/2 is at least ~0.008 of
      // relative luminance per dot even in the dark toe of the gamma curve.
      expect(luminanceStep).toBeLessThan(0.008 + LUMINANCE_JITTER * 0.5)
    }
  })
})
