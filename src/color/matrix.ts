import type { SrgbColor } from '../domain/calibration'

export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]

export function multiplyMatrix3(
  matrix: Matrix3,
  vector: SrgbColor,
): SrgbColor {
  return [
    matrix[0][0] * vector[0] +
      matrix[0][1] * vector[1] +
      matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] +
      matrix[1][1] * vector[1] +
      matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] +
      matrix[2][1] * vector[1] +
      matrix[2][2] * vector[2],
  ]
}

export function interpolateMatrix3(
  lower: Matrix3,
  upper: Matrix3,
  amount: number,
): Matrix3 {
  const row = (index: 0 | 1 | 2): readonly [number, number, number] => [
    lower[index][0] + (upper[index][0] - lower[index][0]) * amount,
    lower[index][1] + (upper[index][1] - lower[index][1]) * amount,
    lower[index][2] + (upper[index][2] - lower[index][2]) * amount,
  ]

  return [row(0), row(1), row(2)]
}
